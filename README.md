pogoplug-api
==============

[![NPM version][npm-badge]](http://badge.fury.io/js/pogoplug-api)
[![Build status][travis-badge]](https://travis-ci.org/kuronekomichael/node-pogoplug-api)
[npm-badge]: https://badge.fury.io/js/pogoplug-api.png
[travis-badge]: https://travis-ci.org/kuronekomichael/node-pogoplug-api.svg?branch=master

UNOFFICIAL pogoplug api for nodejs

## Features

- login
- listing files
- upload file

## Getting Started

```
npm install pogoplug-api
```

### Example:

```
var Pogoplug = require('pogoplug-api');
var client = new Pogoplug();

client.login('<your-pogoplug-mailaddress>', '<oyur-pogoplug-password>', function(err, token) {

   client.getCloudInfo(function(err, info) {
       if (err) {
           console.error(err);
           return;
       }
       console.log(info);
   });
});
```

## API

### client.login('pogoplug-mail', 'pogoplug-password', function(err, token){ .. })

sign up to Pogoplug.  
callback format: `callback(err, token)`

### client.findFileByPath('/path/to/remoteFile', function(err, file){ .. })

get file stat

### client.isExists('/path/to/remoteFile', function(err, isExists){ .. })

`isExists` is boolean

### client.mkdir('/path/to/remoteDir', function(err, createdDir){ .. })

make directory and get this stat

### client.upload(fromPath, toPath)

upload from-Path to-Path

```
client.upload('', '')
.on('data', function(size, totalSize) {
    // got progress
})
.on('error', function(error) {
    // got error
})
.on('end', function() {
    // upload finished
});
```

## TODO

- Add unit tests(im so tired...)
- Code Organization
