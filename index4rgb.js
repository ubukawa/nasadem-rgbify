//modules
const config = require('config')
const fs = require('fs')
const {spawn} = require('child_process')
const Queue = require('better-queue')

//config parameters
const mergeDir = config.get('mergeDir')
const mbtilesDir = config.get('mbtilesDir')
const rasterioPath = config.get('rasterioPath')
const maxZ = config.get('maxZ')
const minZ = config.get('minZ')

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

let mgfileList = fs.readdirSync(mergeDir) //list from the merge folder
mgfileList = mgfileList.filter(r => r.indexOf('.tif') !== -1) //only tiff file


for (let i=0; i<mgfileList.length; i++){
    keys.push(mgfileList[i].replace('.tif',''))
}

const queue = new Queue(async (t, cb) => {
    //const startTime = new Date()
    const key = t.key
    const tile = t.tile
    const [z, x, y] = tile
    const mergedPath = `${mergeDir}/${key}.tif`
    const tmpPath = `${mbtilesDir}/part-${key}.mbtiles`
    const dstPath = `${mbtilesDir}/${key}.mbtiles`
    countModule ++

    keyInProgress.push(key)
    console.log(`[${keyInProgress}] in progress`)
    console.log(`--- ${key} (${countModule}/${keys.length}) starts`) //list of src files

    const rgbStartTime = new Date()


    if(fs.existsSync(dstPath)){
        console.log(`--- ${key}: file already exists (${rgbStartTime.toISOString()})`)
        keyInProgress = keyInProgress.filter((v) => !(v === key)) 
        return cb()        
    } else {
        const rgbify = spawn(rasterioPath, [
            'rgbify', '-b','-10000','-i','0.1', '--max-z', maxZ, '--min-z', minZ,
            '--format', 'webp', '--bounding-tile', `[${x.toString()},${y.toString()},${z.toString()}]`, 
            mergedPath, tmpPath
        ])
        //rgbify.stdout.on('data', (data) => {
        //    console.log(`stdout: ${data}`)
        //})
        rgbify.stderr.on('data', (data) =>{
            console.log(`stderr(at rgbify):${data}`)
        })
        rgbify.on('error', (error) => console.log(error.message.message))
        rgbify.on('exit', (code, signal) =>{
            if(code) console.log(`process exit with code: ${code}.`)
            if(signal) console.log(`process killed with signal: ${signal}.`)
            keyInProgress = keyInProgress.filter((v) => !(v === key)) 
            fs.renameSync(tmpPath,dstPath)
            //fs.unlinkSync(mergedPath)
            const rgbEndTime = new Date() 
            console.log(`--- ${key} ends:  (${rgbStartTime.toISOString()} --> ${rgbEndTime.toISOString()} )`)
            return cb()
        })
    }
},{
    concurrent: config.get('concurrent'),
    maxRetries: config.get('maxRetries'),
    retryDelay: config.get('retryDelay')
})

const queueTasks = () => {
    for (let key of keys){
    //for (let tile of [[6,32,20],[6,32,21],[6,32,22],[6,32,23],[6,33,20],[6,33,21],[6,33,22]]){
    //for (let key of ['bndl1', 'bndl2', 'bndl3', 'bndl4', 'bndl5', 'bndl6']){
        let tile = key.split('-').map(v => Number(v))
        queue.push({
            key: key,
            tile: tile
        })
    }
}

const shutdown = () => {
    console.log('** production system shutdown! (^_^) **')
  }

  const main = async () =>{
    const stTime = new Date()
    console.log(`-------UNVT---------------\n${stTime.toISOString()}: Production starts. \n- From the merged files, we have ${keys.length} modules with NASADEM. \n- Here is the list of ${keys.length} modules: \n${keys}\n--------------------------`)
    queueTasks()
    queue.on('drain', () => {
        const closeTime = new Date()
        console.log(`Production ends: ${stTime.toISOString()} --> ${closeTime.toISOString()}`)
        shutdown()
    })
}

main()