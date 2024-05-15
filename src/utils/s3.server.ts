import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    endpoint: process.env.bucketEndpoint,
    region: process.env.bucketRegion,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});

export const getBucketName = () => {
    return process.env.bucketName!;
}

export const uploadToS3 = async (keyName: string, body: Buffer) => {
    try {
        await s3.send(new PutObjectCommand({
            Bucket: getBucketName(),
            Key: keyName,
            Body: body,
            ACL: 'public-read'
        }));
        return true;
    } catch (err) {
        console.log("Error Upload: ", err);
        return false;
    }
}