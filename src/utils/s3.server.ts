import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({
    endpoint: process.env.bucketEndpoint,
    region: process.env.bucketRegion
});

var bucketName = process.env.bucketName;

const uploadToS3 = async (keyName: string, body: Readable) => {
    try {
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: keyName,
            Body: body
        }));
        return true;
    } catch (err) {
        console.log("Error: ", err);
        return false;
    }
}

export default uploadToS3;