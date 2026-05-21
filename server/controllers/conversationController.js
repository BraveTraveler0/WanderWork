const Conversation = require('../models/Conversation')
const asyncHandler = require('express-async-handler')


const createConversation = asyncHandler(async (req, res)=> {
    const {participants} = req.body;
    if(participants[0] === participants[1]) return res.status(500).json({message: 'Chat with yourself is not possible.'});
    try{
        // Attempt to find an existing conversation with the exact participants
        let conversation = await Conversation.findOne({
            participants: { $all: participants, $size: participants.length }
        });

        if (!conversation) {
            // If no existing conversation, create a new one
            conversation = new Conversation({ participants });
            await conversation.save();
        }
        res.status(201).json(conversation);
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating conversation' });
    }
})

const getConversations = asyncHandler(async (req, res)=> {
    
    try{
        const conversations = await Conversation.find({participants: { $in: [req.params.userId]}}).populate({path: 'participants', select: 'displayName profimage _id'})
        if(conversations){
            res.status(201).json(conversations);
        }else{
            res.status(201).json({message: "No Converations"})
        }
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error finding conversation' });
    }
})

module.exports = {
    createConversation,
    getConversations
}