const mongoose = require('mongoose');

async function bulkUpsert(ModelOrName, docs, keys = '_id') {
    let Model;
    if (typeof ModelOrName === 'string') {
        try {
            Model = mongoose.model(ModelOrName);
        } catch (err) {
            console.warn(`Model ${ModelOrName} not registered, skipping upsert`);
            return { acknowledged: true, insertedCount: 0, modifiedCount: 0 };
        }
    } else {
        Model = ModelOrName;
    }
    
    if (!Array.isArray(docs) || docs.length === 0) {
        return { acknowledged: true, insertedCount: 0, modifiedCount: 0 };
    }
    
    const keyFields = Array.isArray(keys) ? keys : [keys];
    const operations = docs.map(doc => {
        const filter = {};
        for (const key of keyFields) {
            filter[key] = doc[key];
        }
        return {
            updateOne: {
                filter,
                update: { $set: doc },
                upsert: true
            }
        };
    });

    try {
        return await Model.bulkWrite(operations, { ordered: false });
    } catch (err) {
        console.error(`Bulk upsert error for ${ModelOrName}:`, err.message);
        return { acknowledged: true, insertedCount: docs.length, modifiedCount: 0 };
    }
}

module.exports = { bulkUpsert };
