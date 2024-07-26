const mongoose = require('mongoose');

const DestinationSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String
    },
    mintedTokenId: {
      type: Number
    },
    amount: {
        type: Number
    },
    timestamp: {
        type: Number
    },
    status: {
        type: String
    }
  },
  { timestamps: true },
);
module.exports = mongoose.model('DestinationSchema', DestinationSchema); 
