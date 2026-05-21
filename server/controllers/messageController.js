const Message = require('../models/Message')
const Conversation = require('../models/Conversation');
const asyncHandler = require('express-async-handler')


const createMessage = asyncHandler(async (req, res)=> {
    const newMessage = new Message(req.body);
    try{
        const savedMessage = await newMessage.save();
        const conversation = await Conversation.findByIdAndUpdate(savedMessage.conversationId, {last_message: savedMessage}, {new: true})
        console.log(conversation)
        res.status(201).json(savedMessage);
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating Message' });
    }
})

const getMessages = asyncHandler( async(req, res) =>{
    try{
        const messages = await Message.find({conversationId: req.params.conversationId}).populate({path: 'senderId', select: 'displayName profimage _id'})
        if(messages){
            res.status(201).json(messages);
        }else{
            res.status(201).json({message: "No Messages"})
        }
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error finding messages' });
    }
})

module.exports = {
    createMessage,
    getMessages,
}