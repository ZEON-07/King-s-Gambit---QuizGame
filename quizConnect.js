const channel = new BroadcastChannel("quizChannel");
const ping = new BroadcastChannel("ping");
const body = document.body;
const qsd = document.getElementsByClassName("quizQ")[0];
const asd = document.getElementsByClassName("quizA")[0];

var connectApp = {
  isOn: true,
  serverConnected: false,
  isRunningSequence: false,
};

window.onload = async function () {
  A("hide");
  Q("hide");
  ping.postMessage({
    request: "server",
    action: "connect",
    from: "quizConnect",
  });
};

ping.onmessage = async (event) => {
  var msg = event.data;
  if (msg.OVERRIDE != true) {
    if (msg.request == "App") {
      if (msg.from == "server") {
        console.log("connect request from server received", msg.action);
        if (msg.action == "connect") {
          connectApp.serverConnected = true;
          console.log("Server connected");
        } else if (msg.action == "query") {
          console.log("query from server received");
          if (msg.query == "isOn") {
            console.log("query from server for isOn received");
            ping.postMessage({
              request: "server",
              action: "reply",
              from: "quizConnect",
              for: "isOn",
              data: connectApp.isOn,
            });

            console.log("reply sent");
          } else if (msg.query == "isConnected") {
            console.log("query from server for isConnected received");
            ping.postMessage({
              request: "server",
              action: "reply",
              from: "quizConnect",
              for: "isConnected",
              data: connectApp.serverConnected,
            });
            console.log("reply sent");
          }
        }
      }
    }
  }else if(msg.OVERRIDE){
    console.log("OVERRIDE received");
    if(msg.control == "Seq"){
        connectApp.isRunningSequence = msg.data
        if(connectApp.isRunningSequence){
            console.log("Sequence is running");
            MasterOVERRIDE("hide");
        }else{
            MasterOVERRIDE("show");
        }
    }
  }
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

channel.onmessage = async (event) => {
  var msg = event.data;
  
  if (msg.control == "set") {
    A("set", msg.data.a);
    Q("set", msg.data.q);
    await sleep(500);
    // A("show");
    // Q("show");
  }
  if (msg.control == "update") {
  }
  if (msg.control == "Ahide") {
    A("hide");
  }
  if (msg.control == "Ashow") {
    A("show");
  }
  if (msg.control == "QHide") {
    Q("hide");
  }
  if (msg.control == "QShow") {
    Q("show");
  }
  if (msg.control == "MasterHide") {
    Master("hide");
  }
  if (msg.control == "MasterShow") {
    Master("show");
  }
  if (msg.control == "showScore") {
  }
  if (msg.control == "hideScore") {
  }
  if (msg.control == "showAnswer") {
    A("show");
    Q("hide");
  }
  if (msg.control == "hideAnswer") {
    A("hide");
    Q("show");
  }
};

async function MasterOVERRIDE(action) {
    if(action == "hide"){
        body.style.opacity = "0";

        body.style.display = "none";
    }else{
        body.style.display = "block";
        body.style.opacity = "1";
    }
}

function Master(action) {
  if (action == "hide") {
    body.style.opacity = "0";
  }
  if (action == "show") {
    body.style.opacity = "1";
  }
}

function Q(action, q) {
  if (action == "hide") {
    qsd.style.opacity = "0";
  }
  if (action == "show") {
    qsd.style.opacity = "1";
  }
  if (action == "set") {
    qsd.innerHTML = q;
  }
}

function A(action, a) {
  if (action == "hide") {
    asd.style.opacity = "0";
    asd.style.transform = "translateY(110%)";

    sleep(300).then(() => {
      qsd.style.transform = "translateY(0%)";
    });
  }
  if (action == "show") {
    asd.style.opacity = "1";

    asd.style.transform = "translateY(-110%)";

    sleep(300).then(() => {
      // qsd.style.transform = "translateY(-20%)";
    });
  }
  if (action == "set") {
    asd.innerHTML = a;
  }
}
