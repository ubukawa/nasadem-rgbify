# nasadem-rgbify
Creation of RGB elevation tile from NASA dem


# Procedure
## Download
Obtain NASA user account at https://urs.earthdata.nasa.gov/users/new

```
touch ~/.netrc | chmod og-rw ~/.netrc | echo machine urs.earthdata.nasa.gov >> ~/.netrc
echo login YourID >> ~/.netrc
echo password YourPassword >> ~/.netrc
cd src
./dl.sh
```


