import dotenv from 'dotenv';

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/journey';
