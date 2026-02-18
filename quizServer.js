const channel = new BroadcastChannel('quizChannel');
const ping = new BroadcastChannel('ping');
var score = {
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
    p5: 0,
    p6: 0,
}
var actionSequence = [];

var serverStatus = {
    connected: false,
    isOn : true
}
var buttonStatus ={
    M: {
        active: true,
        elem: elem("M"),
        action : function(){
            if(this.active){
                sendMessage({
                    control: ["MasterHide"]
                });
                this.active = false;
                actionSequence.push("MasterHide");
            }else{
                sendMessage({
                    control: ["MasterShow"]
                })
                this.active = true;
                actionSequence.push("MasterShow");
            }
        }
    },
    Q:{
        active: true,
        elem: elem("Q"),
        action : function(){
            if(this.active){
                sendMessage({
                    control: ["QHide"]
                    
                })
                this.active = false;
                actionSequence.push("QHide");
            }else{
                sendMessage({
                    control: ["QShow"]
                })
                this.active = true;
                actionSequence.push("QShow");
            
            }
        }
    },
    A : {
        active: false,
        elem: elem("A"),
        action : function(){
            if(this.active){
                sendMessage({
                    control: ["Ahide"]
                })
                this.active = false;
                actionSequence.push("Ahide");
            }else{
                sendMessage({
                    control: ["Ashow"]
                })
                this.active = true;
                actionSequence.push("Ashow");
            }
        }
    },
    ANS:{
        active: false,
        elem: elem("ANS"),
        action : function(){
            if(this.active){
                sendMessage({
                    control: ["hideAnswer"]
                })
                buttonStatus.A.active = false;
                buttonStatus.Q.active = true;
                toggle(buttonStatus.A)
                toggle(buttonStatus.Q)
                this.active = false;
                actionSequence.push("hideAnswer");
            }else{
                sendMessage({
                    control: ["showAnswer"]
                })
                this.active = true;
                buttonStatus.A.active = true;
                buttonStatus.Q.active = false;
                toggle(buttonStatus.A)
                toggle(buttonStatus.Q)
                actionSequence.push("showAnswer");
            }
        }
    },
    SC : {
        active: false,
        elem: elem("SC")
    },
    SET : {
        active: false,
        elem: elem("SET"),
        action: function(){
            if((this.active)!=true){
                sendMessage({
                    control: ["set"],
                    data:{
                        q:quiz[qi].q,
                        a:quiz[qi].a
                    }
                })
                this.active = false;
                actionSequence.push("set");
            }
        }
    },
    UPD : {
        active: false,
        elem: elem("UPD"),
        disabled : false
    },
    RE :{
        active: false,
        elem: elem("RE")
    
    },
    DEL :{
        active: false,
        elem: elem("DEL"),
        disabled :true
    },
    qNext:{
        active:false,
        elem: elem("qNext"),
        action: function(){
            if(qi < quiz.length){
                qi++;
                sendMessage({
                    control: ["set"],
                    data:{
                        q:quiz[qi].q,
                        a:quiz[qi].a
                    }
                })
            }
        }
    },
    qPrev:{
        active:false,
        elem: elem("qPrev"),
        action: function(){
            if(qi > 0){
                qi--;
                sendMessage({
                    control: ["set"],
                    data:{
                        q:quiz[qi].q,
                        a:quiz[qi].a
                    }
                })
            }
        }
    }

}


async function pressOnce(buttonObj){
    buttonObj.elem.classList.add("active");
    buttonObj.elem.classList.remove("inactive");
    buttonObj.active = true;
    await sleep(100);
    buttonObj.elem.classList.remove("active");
    buttonObj.elem.classList.add("inactive");
    buttonObj.active = false;
}

async function toggle(buttonObj,type="anim",override = false,set = null){
    if(type == "control"){
        if(override){
            if(set!=null){
                buttonObj.active = set;
                if(set){
                    buttonObj.elem.classList.add("active");
                    buttonObj.elem.classList.remove("inactive");
                    buttonObj.action();
                }else{
                    buttonObj.elem.classList.remove("active");
                    buttonObj.elem.classList.add("inactive");
                    buttonObj.action();
                }
            }else{
                throw "set value not provided";
            }
        }else{
            // console.log(buttonObj);
            buttonObj.action();
            if(buttonObj.active){
                buttonObj.elem.classList.add("active");
                buttonObj.elem.classList.remove("inactive");
            }else{
                buttonObj.elem.classList.remove("active");
                buttonObj.elem.classList.add("inactive");
            }
        }
    }else{
        if(buttonObj.active){
            buttonObj.elem.classList.add("active");
            buttonObj.elem.classList.remove("inactive");
            // buttonObj.active = false;
        }
        else{
            buttonObj.elem.classList.remove("active");
            buttonObj.elem.classList.add("inactive");
            // buttonObj.active = true;
        }
    }

}
async function warnOn(buttonObj){
    buttonObj.elem.classList.add("orange");
    buttonObj.elem.classList.remove("inactive"); 
    buttonObj.elem.classList.remove("active");
    await sleep(100);
    buttonObj.elem.classList.remove("orange");
    buttonObj.active = false;
    toggle(buttonObj);
    return;
}

function elem(id){
    return document.getElementById(id);
}
function setloaderProgress(per,color = "#00c3ff"){
    elem("qstatus").style.width = per + "%";
    elem("qstatus").style.background = color;

}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sentStatusUpdate(){
    sentPing({
        OVERRIDE: true,
        control:"Seq",
        data:true
    })

    actionSequence.forEach((action)=>{
        sendMessage({
            control: [action]
        })
    })

    await sleep(500);

    sentPing({
        OVERRIDE: true,
        control:"Seq",
        data:false
    })
}
function sendMessage(msg){
    /**
     * msg schema:
     * {
     * symbianType:"quiz" || "score",
     * data: {
     * },
     * score: {
            p1: 0,
            p2: 0,
            p3: 0,
            p4: 0,
            p5: 0,
            p6: 0,
     * 
     * }
     * control:"set"||"update"||"Ahide"||"Ashow","QHide"||"QShow"||"MasterHide"||"MasterShow"||showScore"
     * }
     * 
     */
    channel.postMessage(msg);
}
quiz = []
qi = 0
async function loadQuiz(){
    const response = await fetch('questions.json');
    const data = await response.json();
    quiz = data;
}

elem("qFile").addEventListener("change", function(){
    const reader = new FileReader();
    reader.onload = function(){
        quiz = JSON.parse(reader.result);
        console.log("file loaded", quiz);
    }
    reader.readAsText(this.files[0]);
    
})

async function buttonSequence(){
    var buttons = document.getElementsByClassName("switch");
    await sleep(200);

    for(var i = 0; i < buttons.length; i++){
        button =buttonStatus[buttons[i].id];
        let aac = button.active;
        
        await toggle(button);
        setloaderProgress(100/buttons.length);
        await sleep(50);
        await warnOn(button);
        await sleep(200);
        await toggle(button);
        await sleep(50);
        await toggle(button);
        if(aac){
            await sleep(10);
            buttonStatus[buttons[i].id].active = false;
            await toggle(button,type="control");
        }
    }
    setloaderProgress(0);
}

async function startup(){
    var msg = {
        control: ["MasterHide"]
    }
    buttonSequence();
    sendMessage(msg);
    await loadQuiz();
    var msg = {
        symbianType: "quiz",
        data: quiz[qi],
        control:"set"
    }
    sendMessage(msg);

    var msg = {
        control: ["MasterShow"]
    }
    sendMessage(msg);
}


function sentPing(msg){
    ping.postMessage(msg);
}



ping.onmessage = async(event) => {
    var msg = event.data;
    if(msg.request == "server"){
        if(msg.from == "quizConnect"){
            if(msg.action == "connect"){
                console.log("Server connect request received");

                if(serverStatus.connected){

                    console.log("Server reports as already connected");
                    setloaderProgress(100,"red")
                    sendMessage({
                        control:['MasterHide']
                    })
                    sentPing({
                        request: "App",
                        action: "connect",
                        from : "server"
                    });
                    if(buttonStatus.M.active){
                        sendMessage({
                            control:['MasterShow']
                        })
                    }
                    sentStatusUpdate()
                    setloaderProgress(100,"#20fc03")
                    await sleep(500);
                    setloaderProgress(0,"red")
                }else{
                sentPing({
                    request: "App",
                    action: "query",
                    query : "isOn",
                    from : "server"
                });
                console.log("query sent");
            }
            }
            else if(msg.action == "reply"){
                if(msg.for == "isOn"){
                    console.log("query reply for isOn received");
                    await sleep(100);
                    setloaderProgress(50)
                    if(serverStatus.isOn){
                        sentPing({
                            request: "App",
                            action: "query",
                            query : "isConnected",
                            from : "server"
                        });
                        console.log("query sent");
                        sentStatusUpdate()
                    }

                }
               else if(msg.for == "isConnected"){
                    console.log("query reply for isConnected received");
                    await sleep(100);
                    setloaderProgress(60)
                    console.log(msg.data);
                    if(!(msg.data)){
                        serverStatus.connected = true;
                        sentPing({
                            request: "App",
                            action: "connect",
                            from : "server"
                        });
                        console.log("Server connected");
                        setloaderProgress(100)
                    }else{
                        await sleep(100);
                        setloaderProgress(100,'red')
                        console.log("App reports as already connected");
                        // do something
                        sentPing({
                            request: "App",
                            action: "connect",
                            from : "server"
                        });
                        serverStatus.connected = true;
                        sendMessage({
                            control:['MasterHide']
                        })
                        await sleep(500)
                        setloaderProgress(100,"#20fc03")
                        await sleep(500);
                        setloaderProgress(100)
                        await sleep(100);
                        setloaderProgress(0)
                        startup();
                    }
                }
            }
        }
    }
}


window.onload = async function(){
    setloaderProgress(25);
    sentPing({
        request:"App",
        action:"query",
        query:"isOn",
        from:"server"
    })
}