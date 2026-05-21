const Votes = require('../models/votes.js')
const Voiting = require('../models/voiting.js')
const User = require('../models/User')
const asyncHandler = require('express-async-handler');
const { use } = require('../routes/userRoutes.js');

const getAllVotes = asyncHandler(async (req, res) => {
    try {
        const votes = await Votes.find();

        if (!votes?.length) {
            return res.status(400).json({ message: 'No voiting found' });
        }

        res.json(votes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching voiting' });
    }
});

const getVotesById = asyncHandler(async (req, res) => {
    const { id } = req.params; // Assuming id is passed in the request parameters

    try {
        // Assuming your model has a voting_id field
        const votes = await Votes.find({ voting_id: id });

        if (!votes.length) {
            return res.status(400).json({ message: 'No votes found' });
        }

        res.json(votes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching votes' });
    }
});



const getUserVotesById = asyncHandler(async (req, res) => {
    const { id } = req.params; // Assuming id is passed in the request parameters

    try {
        const votes = await Votes.find({ user_id: id });

        if (!votes.length) {
            return res.status(400).json({ message: 'No votes found' });
        }

        res.json(votes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching votes' });
    }
});

const createVotesold = asyncHandler(async (req, res) => {/// This is to actually vote on a vote that is already created.
    try {
        const { user_id, voiting_id, star, option } = req.body;

        if (!user_id || !voiting_id || !star || !option) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const voteObject = { user_id, voiting_id, star, option };
        const voiting = await Voiting.findById(voiting_id);
        if (!voiting) {
            return res.status(404).json({ message: 'Voiting not found' });
        }
        if (option === voiting.option1) {
            const total = voiting.ratingsOption1 + star
            voiting.ratingsOption1 = parseInt(total);
        } else if (option === voiting.option2) {
            const total = voiting.ratingsOption2 + star
            voiting.ratingsOption2 = parseInt(total);
        }
        await voiting.save();
        const user = await User.findById(user_id)
        if (!user) {
            return res.status(404).json({ message: 'Voiting not found' });
        }
        const starupdate = user.stars - star
        user.stars = starupdate
        const userUpdate = await user.save();
        const votes = await Votes.create(voteObject);
        res.status(201).json({
            message: votes,
            stars: userUpdate.stars
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while creating voiting' });
    }
});

const voteStars = asyncHandler(async (req, res) => {
    const {starDonator } = req.body
    console.log(starDonator)
    // Confirm data 
    if (!starDonator) {
      return res.status(400).json({ message: 'Post id and user are required' })
    }
  
    // Find the user in the database and subtract their "stars" by 1
    const userToUpdate = await User.findOne({ $or: [{ _id: starDonator }, { slug: starDonator }] }).exec();
    if (userToUpdate) {
      userToUpdate.stars = Math.max(0, (userToUpdate.stars || 0) - 1);
      await userToUpdate.save();
    }
    res.json({ message: "vote updated" })
  });

const createVotes = asyncHandler(async (req, res) => {/// This is to actually vote on a vote that is already created.
    try {
        // Extract necessary data from the request body or parameters
        const { user_id, voting_id } = req.body;
    
        // Check if the user has already voted (example logic)

        const existingVote = await Votes.findOne({ user_id, voting_id });
    
        if (existingVote) {
          return res.status(202).json({ message: 'User has already voted on this vote.' });
        }
    
        // If not voted yet, create a new vote record
        const newVote = new Votes({
          user_id,
          voting_id,
          createdDate: Date.now(),
          // other properties...
        });
    
        // Save the new vote record to the database
        const savedVote = await newVote.save();
    
        res.status(201).json(savedVote);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while creating voting' });
      }
});
const deleteVotes = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Votes ID is required' });
    }

    try {
        const deletedVote = await Votes.findByIdAndRemove(id);
        if (!deletedVote) {
            return res.status(404).json({ message: 'Votes not found' });
        }

        res.json({ message: 'Votes deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting Votes' });
    }
});

module.exports = {
    getAllVotes,
    createVotes,
    deleteVotes,
    getVotesById,
    voteStars
}

