const http = require("http");
const express = require("express");
const WSServer = require("ws").Server;
var favicon = require("serve-favicon");
let server;
const app = express();

app.use(favicon(__dirname + '/client/assets/server.png'));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/client/index.html");
});

server = new http.createServer(app);
var wss = new WSServer({ server });

//all connected to the server users
var users = {};

//when a user connects to our sever
wss.on("connection", function (connection) {
  console.log("User connected");

  //when server gets a message from a connected user
  connection.on("message", function (message) {
    var data;
    //accepting only JSON messages
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    //switching type of the user message
    switch (data.type) {
      //when a user tries to login

      case "login":
        //if anyone is logged in with this username then refuse
        if (users[data.name]) {
          console.log("User already exist and logged in");
          sendTo(connection, {
            type: "login",
            success: false,
          });
        } else {
          console.log("User logged", data.name);
          //save user connection on the server
          users[data.name] = connection;
          connection.name = data.name;

          sendTo(connection, {
            type: "login",
            success: true,
          });
        }

        break;

      case "offer":
        //for ex. UserA wants to call UserB
        console.log("Sending offer to: ", data.name);

        //if UserB exists then send him offer details
        var conn = users[data.name];
        if (conn != null && conn.otherName != undefined) {
          sendTo(connection, {
            type: "busy",
          });
        } else {
          if (conn != null && conn.otherName == undefined) {
            //setting that UserA connected with UserB
            connection.otherName = data.name;
            sendTo(conn, {
              type: "offer",
              offer: data.offer,
              name: connection.name,
            });
          } else {
            sendTo(connection, {
              type: "nouser",
            });
          }
        }
        break;

      case "answer":
        console.log("Sending answer to: ", data.name);
        //for ex. UserB answers UserA
        var conn = users[data.name];
        if (conn != null) {
          connection.otherName = data.name;
          sendTo(conn, {
            type: "answer",
            answer: data.answer,
          });
        }
        break;

      case "candidate":
        //sending candidate
        console.log("Sending candidate to:", data.name);
        var conn = users[data.name];

        if (conn != null) {
          sendTo(conn, {
            type: "candidate",
            candidate: data.candidate,
          });
        }

        break;

      case "leave":
        console.log("Disconnecting from", data.name);
        var conn = users[data.name];
        conn.otherName = null;

        //notify the other user so he can disconnect his peer connection
        if (conn != null) {
          sendTo(conn, {
            type: "leave",
          });
        }

        break;

      default:
        //no such command exist
        sendTo(connection, {
          type: "error",
          message: "Command not found: " + data.type,
        });

        break;
    }
  });

  //when user exits, for example closes a browser window
  //this may help if we are still in "offer","answer" or "candidate" state
  connection.on("close", function () {
    if (connection.name) {
      delete users[connection.name];
      if (connection.otherName) {
        console.log("Disconnecting from ", connection.otherName);
        var conn = users[connection.otherName];
        if (conn != undefined) {
          conn.otherName = null;
        }
        if (conn != null) {
          sendTo(conn, {
            type: "leave",
          });
        }
      }
    }
  });

  sendTo(connection, {
    type: "message",
    message: "Hello from the server",
  });
});

//send json message to particular "connection"
function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

server.on("error", (err) => console.log("Server error:", err));
server.listen(process.env.PORT || 9090, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});
