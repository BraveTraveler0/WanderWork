const S3 = require('aws-sdk/clients/s3')
const fs = require('fs')

const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_KEY

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
})

//uploads a file to s3
function uploadFile(outputImagePath,file) {
    const filestream = fs.createReadStream(outputImagePath)  

    console.log("Bucket", bucketName)

    const uploadParams = {
        Bucket: bucketName,
        Body: filestream,
        Key: file.filename
    }

    return s3.upload(uploadParams).promise()
}

exports.uploadFile = uploadFile

//downloads a file form s3
function getFileStream(fileKey) {
    const downloadParams = {
        Key: fileKey,
        Bucket: bucketName
    }

    return s3.getObject(downloadParams).createReadStream()
}

exports.getFileStream = getFileStream