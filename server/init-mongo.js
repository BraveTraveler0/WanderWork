// init-mongo.js
conn = new Mongo("mongodb://aon-local:27017");
db = conn.getDB("admin");

rs.initiate({
  _id: "aon-replica-set",
  members: [
    { _id: 0, host: "aon-local:27017" },
    { _id: 1, host: "aon-local2:27017" }
  ]
});

print("Replica set initiated successfully!");