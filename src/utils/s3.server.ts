import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({
    endpoint: process.env.bucketEndpoint,
    region: process.env.bucketRegion,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});

var bucketName = process.env.bucketName;

const uploadToS3 = async (keyName: string, body: Buffer) => {
    try {
        console.log(s3.config.credentials());
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