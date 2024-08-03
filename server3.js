const WebSocket = require("ws");
const axios = require("axios");
const dbSchema = require("./model/sourceSchema");
const destinationSchema = require("./model/destinationSchema");
const mongoose = require("mongoose");
const { Web3 } = require("web3");

const providerBSC = new Web3.providers.HttpProvider(
  "https://data-seed-prebsc-1-s1.binance.org:8545/"
);

const providerAvalanche = new Web3.providers.HttpProvider(
  "https://api.avax-test.network/ext/bc/C/rpc"
);

const web3BSC = new Web3(providerBSC);
const web3Avalanche = new Web3(providerAvalanche);

const connections = [];

const mongoConnection = async () => {
  const mongoURL =
    "mongodb+srv://tusharbansal:tushar.12@cluster0.wxapsti.mongodb.net/FireFly?retryWrites=true&w=majority";
  mongoose
    .connect(mongoURL, {})
    .then((result) => {
      console.log("Failed to connect to DB on startup " + dbError.message);
    })
    .catch((err) => {
      console.log("MongoDB connection established successfully!");
    });
  const connection = mongoose.connection;
};
mongoConnection();

async function saveData() {
  const inputData = {
    transactionId: "eventsData[0]",
    tokenSmartContract: "eventsData[1]",
    tokenId: 2,
    amount: 2,
    owner: "eventsData[4]",
    timestamp: 123,
    secret: "secretHash",
    status: "eventsData[7]",
    destinationId: "eventsData[8]",
    receiverAddr: "eventsData[9]",
  };
  const dbschema = new dbSchema(inputData);

  let data = await dbschema.save(dbschema);
  console.log(data);
}

async function fetchData() {
  let tx = await dbSchema.findOne({
    transactionId:
      "0x520fbd5d06d8a318df796ce1009993c3c6ec2398f5907d91592a94db88e84936",
  });
  console.log(tx);
}

async function updateData() {
  let destinationTx = await destinationSchema.updateOne(
    {
      transactionId:
        "0x623824bc3251216801c41f8eaa7f8229ca131f535578ac7874ad7828a88ef27e",
    },
    { $set: { status: "withdrawalReady" } }
  );
  console.log(destinationTx);
}

async function connectAndSend(url, message) {
  const ws = new WebSocket(url);

  ws.on("open", function open() {
    console.log(`Connected to ${url}`);
    ws.send(JSON.stringify(message));
  });

  ws.on("message", async function incoming(data) {
    console.log(`Received message from ${url}:`, data.toString());
    const formatedData = JSON.parse(data.toString());
    console.log(formatedData);
    // Checks the events is being captured from fabric-samples

    if (
      formatedData.type == "blockchain_invoke_op_succeeded" &&
      formatedData.operation.status == "Succeeded"
    ) {
      if (formatedData.operation.input.methodPath == "store") {
        const txHash = formatedData.operation.output.transactionHash;
        console.log("store is invoked");
      }
      if (formatedData.operation.input.methodPath == "transferAndLock") {
        const txHash = formatedData.operation.output.transactionHash;
        const receipt = await web3BSC.eth.getTransactionReceipt(txHash);
        const events = receipt.logs;
        console.log("=========TransferAndLock Events============");
        console.log(events);
        console.log("===========================================");

        const data = events[1].data;
        const eventsData = web3BSC.eth.abi.decodeParameters(
          [
            "bytes32",
            "address",
            "uint256",
            "uint256",
            "address",
            "uint256",
            "string",
            "string",
            "string",
            "string",
          ],
          data
        );
        const secretHash = web3BSC.utils.soliditySha3({
          t: "string",
          v: eventsData[6],
        });
        const inputData = {
          transactionId: eventsData[0],
          tokenSmartContract: eventsData[1],
          tokenId: Number(eventsData[2]),
          amount: Number(eventsData[3]),
          owner: eventsData[4],
          timestamp: Number(eventsData[5]),
          secret: secretHash,
          status: eventsData[7],
          destinationId: eventsData[8],
          receiverAddr: eventsData[9],
        };

        // kalpSourceInfo.set(inputData.transactionId, inputData);
        const dbschema = new dbSchema(inputData);

        let resultData = await dbschema.save(dbschema);
        console.log("Saved Data to DB =======================");
        console.log(resultData);
        console.log("========================================");
        axios
          .post(
            "http://64.227.188.32:6000/api/v1/namespaces/default/apis/destinationChain1/invoke/mintAndLock",
            {
              input: {
                _transactionId: inputData.transactionId,
                _amount: inputData.amount,
              },
            }
          )
          .then((response) => {
            console.log("API Call Response=====================");
            console.log("Status:", response.status);
            console.log("Data:", response.data);
            console.log("========================================");
          })
          .catch((error) => {
            console.error("Error:", error);
          });
      }
      if (formatedData.operation.input.methodPath == "mintAndLock") {
        const txHash = formatedData.operation.output.transactionHash;
        const receipt = await web3Avalanche.eth.getTransactionReceipt(txHash);
        const events = receipt.logs;
        console.log("=========Events =======================");
        console.log(events);
        console.log("========================================");

        const data = events[1].data;

        const eventsData = web3Avalanche.eth.abi.decodeParameters(
          ["bytes32", "uint", "uint", "uint", "string"],
          data
        );

        const inputData = {
          transactionId: eventsData[0],
          mintedTokenId: Number(eventsData[1]),
          amount: Number(eventsData[2]),
          timestamp: Number(eventsData[3]),
          status: eventsData[4],
        };

        const destinationschema = new destinationSchema(inputData);
        let resultData = await destinationschema.save(destinationschema);
        console.log("Saved Data to DB =======================");
        console.log(resultData);
        console.log("========================================");

        let sourceTx = await dbSchema.updateOne(
          { transactionId: resultData.transactionId },
          { $set: { status: "permanentLocked" } }
        );
        console.log(sourceTx);

        let destinationTx = await destinationSchema.updateOne(
          { transactionId: resultData.transactionId },
          { $set: { status: "withdrawalReady" } }
        );
        console.log(destinationTx);
      }

      console.log(formatedData.operation.input.location.address)
      // Destinaton withdraw token
      if (
        formatedData.operation.input.methodPath == "withdrawMintedToken" &&
        formatedData.operation.input.location.address ==
          "0x263bc8023ff40bf07111649b27bbd5cc854064b1"
      ) {
        const txHash = formatedData.operation.output.transactionHash;
        const receipt = await web3Avalanche.eth.getTransactionReceipt(txHash);
        const events = receipt.logs;
        const data = events[0].data;
        const eventsData = web3Avalanche.eth.abi.decodeParameters(
          ["bytes32", "address", "uint", "uint"],
          data
        );
        const transactionId = eventsData[0];
        const caller = eventsData[1];
        const mintedTokenId = Number(eventsData[2]);
        const amount = Number(eventsData[3]);

        let sourceTx = await dbSchema.findOne({ transactionId });
        let destinationTx = await destinationSchema.findOne({ transactionId });
        console.log("sourceTx==========");
        console.log(sourceTx);

        console.log("destinationTx==========");
        console.log(destinationTx);

        if (destinationTx.status == "withdrawalReady") {
          axios
            .post(
              "http://64.227.188.32:6000/api/v1/namespaces/default/apis/destinationChain1/invoke/withdrawMintedTokenResponse",
              {
                input: {
                  _transactionId: transactionId,
                  _owner: caller,
                  _mintedTokenId: mintedTokenId,
                  _amount: amount,
                },
              }
            )
            .then((response) => {
              console.log("API Call Response=====================");
              console.log("Status:", response.status);
              console.log("Data:", response.data);
              console.log("========================================");
            })
            .catch((error) => {
              console.error("Error:", error);
            });
        } 
      }
      // Destinaton withdraw token response
      if (
        formatedData.operation.input.methodPath ==
          "withdrawMintedTokenResponse" &&
        formatedData.operation.input.location.address ==
          "0x263bc8023ff40bf07111649b27bbd5cc854064b1"
      ) {
        const txHash = formatedData.operation.output.transactionHash;
        const receipt = await web3Avalanche.eth.getTransactionReceipt(txHash);
        const events = receipt.logs;
        const data = events[1].data;
        const eventsData = web3Avalanche.eth.abi.decodeParameters(
          ["bytes32", "address", "address", "uint", "uint"],
          data
        );

        const transactionId = eventsData[0];

        let destinationTx = await destinationSchema.updateOne(
          { transactionId },
          { $set: { status: "withdrawn" } }
        );
        console.log(destinationTx);
      }
    }
  });

  ws.on("close", function close() {
    console.log(`Disconnected from ${url}`);
  });

  ws.on("error", function error(err) {
    console.error(`WebSocket error for ${url}:`, err);
  });

  connections.push(ws);
}

// Define Connection Details
// Source Chain
const server1 = {
  url: "ws://64.227.188.32:5000/ws",
  message: {
    type: "start",
    name: "sourceChainGeneral2",
    namespace: "default",
    autoack: true,
  },
};

// Define Connecton Details
// Destinaton Chain
const server2 = {
  url: "ws://64.227.188.32:6000/ws",
  message: {
    type: "start",
    name: "destinationChainGeneral1",
    namespace: "default",
    autoack: true,
  },
};

// Connect to both servers
connectAndSend(server1.url, server1.message);
connectAndSend(server2.url, server2.message);
