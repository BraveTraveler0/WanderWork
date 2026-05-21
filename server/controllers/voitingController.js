const Voiting = require('../models/voiting.js')
const Voting = require('../models/voiting.js')
const asyncHandler = require('express-async-handler')

const getAllVoiting = asyncHandler(async (req, res) => {
    try {
        const voitings = await Voiting.find();

        console.log('pullvotes',voitings)

        if (!voitings) {
            return res.status(400).json({ message: 'No voiting found' });
        }

        res.json(voitings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching voiting' });
    }
});




const getVoitingbyId = asyncHandler(async (req, res) => {
    const id = req.params.id
    try {
        const voitings = await Voiting.find({user_id:id});

        console.log('pullvotes',voitings)

        if (!voitings) {
            return res.status(400).json({ message: 'No voiting found' });
        }

        res.json(voitings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching voiting' });
    }
});

const createVoiting = asyncHandler(async (req, res) => {
    try {
        const { question, submittedBy, openedAt, closedAt, answers} = req.body;

        if (!question || !submittedBy || !openedAt || !closedAt || !answers) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        //const voitingObject = { title, creator, open, close, option1, option2 };
        const voitingObject = { question, submittedBy, openedAt, closedAt, answers };
        const voiting = await Voiting.create(voitingObject);
        res.status(201).json({
            message: voiting,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while creating voiting' });
    }
});


const updateRatings = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Voting ID is required' });
    }
    try {
        const { field, value } = req.body;

        if (!field || !value) {
            return res.status(400).json({ message: 'answerId and value are required' });
        }

        const voting = await Voting.findById(id);

        if (!voting) {
            return res.status(404).json({ message: 'Voting not found' });
        }

        const answer = voting.answers.find(a => a.id === field);

        if (!answer) {
            return res.status(404).json({ message: 'Answer not found' });
        }
            console.log('updating votes', field)
        answer.votes = (answer.votes || 0) + value;

        const votingUpdate = await voting.save();

        res.json({ message: votingUpdate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating ratings' });
    }
});


const deleteVoiting = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Voiting ID is required' });
    }

    try {
        const deletedVoiting = await Voiting.findByIdAndRemove(id);
        if (!deletedVoiting) {
            return res.status(404).json({ message: 'Voiting not found' });
        }

        res.json({ message: 'Voiting deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting voiting' });
    }
});

module.exports = {
    getAllVoiting,
    createVoiting,
    deleteVoiting,
    updateRatings,
    getVoitingbyId

}

