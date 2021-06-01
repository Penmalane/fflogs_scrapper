const MongoClient = require('mongodb').MongoClient;
const slutMaxRetry = 3;

run = async () => {
    const uri = "mongodb+srv://penma:penmalane@cluster0.naf6i.mongodb.net/penmabot?retryWrites=true&w=majority";
    const mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    await mongoClient.connect();
    console.log("Connected to the database");

    console.log('resetting retries...');

    const slutCollection = mongoClient.db("penmabot").collection("slut");
    await slutCollection.updateMany({}, {$set: {slutRetry: slutMaxRetry}});

    console.log("done");
}

run();