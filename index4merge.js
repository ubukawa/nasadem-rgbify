//modules
const config = require('config')
const fs = require('fs')
const {spawn} = require('child_process')
const tilebelt = require('@mapbox/tilebelt')
const Queue = require('better-queue')

//config parameters
const srcDir = config.get('srcDir')
const mergeDir = config.get('mergeDir')
const mbtilesDir = config.get('mbtilesDir')
const gdalmergePath = config.get('gdalmergePath')

let modulesObj = {} //object {key: [srcFile, ... ], ...}
let emptyModules = []
let keys = [] //Array of key such as "6-x-y"
let keyInProgress = []
let idle = true
let countModule = 0

const isIdle = () => {
    return idle
}

const sleep = (wait) => {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {resolve(), wait})
    })
}

let fileList = fs.readdirSync(srcDir) //list from the src folder
fileList = fileList.filter(r => r.indexOf('.hgt') !== -1) //only hgt file 

let nasademFiles = [] //list from the src folder. file name: nXX_eXXX
for (let i=0; i<fileList.length; i++){
    nasademFiles.push(fileList[i].replace('w','_w').replace('e','_e').toLowerCase())
}

//keys (6-x-y)
for (x = 0; x < 64; x ++){
    for (y = 0; y < 64; y++) {
        let key = `6-${x}-${y}`
        keys.push(key)
    }
}

for (const key of keys){
//for (const key of ['6-31-31','6-32-32']){
    let [tilez, tilex, tiley] = key.split('-')
    tilex = Number(tilex)
    tiley = Number(tiley)
    tilez = Number(tilez)
    const bbox = tilebelt.tileToBBOX([tilex, tiley, tilez])
    modulesObj[key] = []

    for (x=Math.floor(bbox[0]); x < bbox[2]; x++ ){
        m = x.toString(10) // 10 means decimal
    
        if(x < 0) {
            m = m.replace("-","")
            if(m.length == 1){
                m = `00${m}`
            } else if (m.length == 2) {
                m = `0${m}`
            }
            m = `W${m}`
        } else {
            if(m.length == 1){
                m = `00${m}`
            } else if (m.length == 2) {
                m = `0${m}`
            }
            m = `E${m}`
        } // Then, m has proper string

        for (y = Math.floor(bbox[1]); y < bbox[3]; y++){
            n = y.toString(10)
            if(y<0){
                n = n.replace("-","")
                if(n.length == 1) {
                    n = `0${n}` 
                }
                n = `S${n}`
            } else {
                if(n.length == 1) {
                    n = `0${n}` 
                }
                n = `N${n}`
            }
            nm = `${n.toLowerCase()}_${m.toLowerCase()}.hgt`
            if(nasademFiles.includes(nm)){
                //console.log (`${nm}---> yes(${key})`)
                modulesObj[key].push(`${srcDir}/${nm}`)
            }    
        }
    }
    if (Object.keys(modulesObj[key]).length == 0) {
        emptyModules.push(key)
    } 
    if (modulesObj[key].length == 0){
        delete modulesObj[key]
    } 

}


const queue = new Queue(async (t, cb) => {
    const key = t.key
    const tile = t.tile
    const [z, x, y] = tile
    const mergedPath = `${mergeDir}/${key}.tif`
    const tmpPath = `${mbtilesDir}/part-${key}.mbtiles`
    const dstPath = `${mbtilesDir}/${key}.mbtiles`
    countModule ++

    keyInProgress.push(key)
    console.log(`[${keyInProgress}] in progress`)

    console.log(`--- ${key} (${countModule}/${Object.keys(modulesObj).length}) starts: ${modulesObj[key].length} src file/files`) //list of src files
    //console.log(`--- ${key} (${countModule}/${Object.keys(modulesObj).length}): ${modulesObj[key].length}   (${modulesObj[key]})`) //list of src files

    let gdalmergeArray = [
        '-o', mergedPath
    ]
    const mgStartTime = new Date()
    gdalmergeArray = gdalmergeArray.concat(modulesObj[key])

    if(fs.existsSync(mergedPath)){
        console.log(`--- ${key}: file already exists (${mgStartTime.toISOString()})`)
        keyInProgress = keyInProgress.filter((v) => !(v === key)) 
        return cb()        
    } else {

    const gdalmerge = spawn(gdalmergePath, gdalmergeArray)
    //gdalmerge.stdout.on('data', (data) => {
    //    console.log(`stdout: ${data}`)
    //})
    gdalmerge.stderr.on('data', (data) =>{
        console.log(`stderr(at merge):${data}`)
    })
    gdalmerge.on('error', (error) => console.log(error.message.message))
    gdalmerge.on('exit', (code, signal) =>{
        if(code) console.log(`process exit with code: ${code}.`)
        if(signal) console.log(`process killed with signal: ${signal}.`)
        const mgEndTime = new Date() 
        console.log(`--- ${key}: ${modulesObj[key].length} src file/files merge ends (${mgStartTime.toISOString()} --> ${mgEndTime.toISOString()} )`)
        keyInProgress = keyInProgress.filter((v) => !(v === key)) 
        //fs.renameSync(tmpPath,dstPath)
        //fs.unlinkSync(mergedPath)
        return cb()

    })
    }
},{
    concurrent: config.get('concurrent'),
    maxRetries: config.get('maxRetries'),
    retryDelay: config.get('retryDelay')
})

const queueTasks = () => {
    for (let module of Object.keys(modulesObj)){
        let tile = module.split('-').map(v => Number(v))
        queue.push({
            key: module,
            tile: tile
        })
    }
}

const shutdown = () => {
    console.log('** production system (merge) shutdown! (^_^) **')
  }

  const main = async () =>{
    const stTime = new Date()
    console.log(`-------UNVT---------------\n${stTime.toISOString()}: Production starts. \n- From the saved sources, we have ${Object.keys(modulesObj).length} modules with SRTM DEM. \n- ${emptyModules.length} modules are without SRTM DEM.\n- Here is the list of ${Object.keys(modulesObj).length} modules: \n${Object.keys(modulesObj)}\n--------------------------`)
    queueTasks()
    queue.on('drain', () => {
        const closeTime = new Date()
        console.log(`Production ends: ${stTime.toISOString()} --> ${closeTime.toISOString()}`)
        shutdown()
    })
}

main()