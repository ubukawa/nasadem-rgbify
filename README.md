# nasadem-rgbify
Creation of RGB elevation tile from NASA dem


# Procedure
##
```
docker run -it --rm -v ${PWD}:/data unvt/rgbify-node
cd /data
```


## Download
Obtain NASA user account at https://urs.earthdata.nasa.gov/users/new

```
touch ~/.netrc | chmod og-rw ~/.netrc | echo machine urs.earthdata.nasa.gov >> ~/.netrc
echo login YourID >> ~/.netrc
echo password YourPassword >> ~/.netrc
mkdir src
cd src
./dl.sh
cd ..
```


