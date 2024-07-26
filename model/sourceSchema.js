const mongoose = require('mongoose');

const SourceSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String
    },
    tokenSmartContract: {
      type: String
    },
    tokenId: {
      type: Number
    },
    amount: {
        type: Number
    },
    secret: {
        type: String
    },
    timestamp: {
        type: Number
    },
    destChainId: {
        type: String
    },
    receiverAddr: {
        type: String
    },
    status: {
        type: String
    }
  },
  { timestamps: true },
);
module.exports = mongoose.model('SourceSchema', SourceSchema); 
