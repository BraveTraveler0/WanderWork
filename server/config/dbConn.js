const mongoose = require('mongoose');

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    try {
        // Set the mongoose buffering timeout before connecting
        mongoose.set('bufferTimeoutMS', 30000); // Increase from default 10000ms

        const conn = await mongoose.connect(process.env.DATABASE_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 100,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            // Add these additional timeout settings
            connectTimeoutMS: 30000,
            bufferCommands: true, // Enable buffering
        });

        mongoose.connection.once('open', async () => {
            try {
                const db = mongoose.connection.db;
                await Promise.all([
                    db.collection('jobseeker.jobs').createIndex({ date_posted: 1 }, { background: true, sparse: true }),
                    db.collection('jobseeker.jobs').createIndex({ datePosted: 1 },  { background: true, sparse: true }),
                ]);
            } catch (e) {
                // Non-fatal — indexes already exist or collection not yet created
            }
        });

        mongoose.connection.on('connected', () => {
            console.log(`MongoDB Connected: ${conn.connection.host}`);
        });

        mongoose.connection.on('error', (err) => {
            console.error('Detailed MongoDB connection error:', {
                message: err.message,
                name: err.name,
                stack: err.stack
            });
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        return conn;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
    }
}

module.exports = connectDB;

/*const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
    try {
        // Enhanced logging configuration
        mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                collectionName,
                methodName,
                args: methodArgs.map(arg => JSON.stringify(arg)),
                stack: new Error().stack
            };

            mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
                if (collectionName === 'postranks' && methodName === 'findOne') {
                  console.trace('Postranks findOne called from:');
                }
              });

            // Log to console
            console.log('MongoDB Debug:', JSON.stringify(logEntry, null, 2));

            // Optionally, log to a file for persistent tracking
            const logFilePath = path.join(__dirname, 'mongodb-debug.log');
            fs.appendFileSync(logFilePath, JSON.stringify(logEntry, null, 2) + '\n');
        });

        mongoose.set('bufferTimeoutMS', 60000); // Increase buffer timeout

        const conn = await mongoose.connect(process.env.DATABASE_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 100,
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 60000,
            retryWrites: true,
            ssl: true,
            sslValidate: true,
            tlsAllowInvalidHostnames: false,
        });

        // Comprehensive connection event logging
        mongoose.connection.on('connected', () => {
            console.log(`MongoDB Connected: ${conn.connection.host}`);
        });

        mongoose.connection.on('error', (err) => {
            console.error('Detailed MongoDB connection error:', {
                message: err.message,
                name: err.name,
                code: err.code,
                stack: err.stack
            });

            // Log error to file
            const errorLogPath = path.join(__dirname, 'mongodb-error.log');
            fs.appendFileSync(errorLogPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                error: {
                    message: err.message,
                    name: err.name,
                    code: err.code,
                    stack: err.stack
                }
            }, null, 2) + '\n');
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            
            // Log disconnection to file
            const disconnectLogPath = path.join(__dirname, 'mongodb-disconnect.log');
            fs.appendFileSync(disconnectLogPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                event: 'Disconnected'
            }, null, 2) + '\n');
        });

        // Monitor connection pool
        const db = conn.connection;
        db.on('open', () => {
            console.log('MongoDB connection pool opened');
        });

        // Optional: Track query performance
        const originalFind = mongoose.Model.find;
        mongoose.Model.find = function(...args) {
            const startTime = Date.now();
            const result = originalFind.apply(this, args);
            result.then(() => {
                const duration = Date.now() - startTime;
                if (duration > 1000) { // Log queries taking more than 1 second
                    console.warn(`Slow query detected: ${duration}ms`, {
                        model: this.modelName,
                        args: JSON.stringify(args)
                    });
                }
            });
            return result;
        };

        return conn;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', {
            message: err.message,
            name: err.name,
            stack: err.stack
        });
        process.exit(1);
    }
}

module.exports = connectDB;  */
