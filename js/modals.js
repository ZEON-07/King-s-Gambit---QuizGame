document.addEventListener("DOMContentLoaded", () => {
    const modalHTML = `
    <div id="customAlertModal" class="modal" style="display:none; z-index: 1000000;">
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <div class="modal-header" style="justify-content: center; background: rgba(0, 195, 255, 0.1); border-bottom: 1px solid rgba(0, 195, 255, 0.2);">
                <h2><i class="fa-solid fa-circle-info" style="color:#00c3ff;"></i> Alert</h2>
            </div>
            <div class="modal-body" style="padding: 30px 25px;">
                <p id="customAlertMessage" style="font-size: 1.1rem; line-height: 1.5; margin: 0; color: #ddd;"></p>
            </div>
            <div class="modal-footer" style="justify-content: center;">
                <button class="primary" id="customAlertBtn" style="width: 100%; max-width: 200px;">OK</button>
            </div>
        </div>
    </div>

    <div id="customConfirmModal" class="modal" style="display:none; z-index: 1000000;">
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <div class="modal-header" style="justify-content: center; background: rgba(255, 165, 0, 0.1); border-bottom: 1px solid rgba(255, 165, 0, 0.2);">
                <h2><i class="fa-solid fa-circle-question" style="color:#ffa500;"></i> Please Confirm</h2>
            </div>
            <div class="modal-body" style="padding: 30px 25px;">
                <p id="customConfirmMessage" style="font-size: 1.1rem; line-height: 1.5; margin: 0; color: #ddd;"></p>
            </div>
            <div class="modal-footer" style="display: flex; gap: 15px;">
                <button class="secondary" id="customConfirmCancelBtn" style="flex: 1;">Cancel</button>
                <button class="primary" id="customConfirmOkBtn" style="flex: 1; background: #ffa500; color: #000;">Confirm</button>
            </div>
        </div>
    </div>

    <div id="customPromptModal" class="modal" style="display:none; z-index: 1000000;">
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <div class="modal-header" style="justify-content: center; background: rgba(0, 195, 255, 0.1); border-bottom: 1px solid rgba(0, 195, 255, 0.2);">
                <h2><i class="fa-solid fa-pen-to-square" style="color:#00c3ff;"></i> Input Required</h2>
            </div>
            <div class="modal-body" style="padding: 30px 25px; display: flex; flex-direction: column; gap: 15px;">
                <p id="customPromptMessage" style="font-size: 1.1rem; line-height: 1.5; margin: 0; color: #ddd;"></p>
                <input type="text" id="customPromptInput" style="padding: 10px; font-size: 1rem; border-radius: 6px; border: 1px solid #444; background: #222; color: #fff; width: 100%; box-sizing: border-box; outline: none;" />
            </div>
            <div class="modal-footer" style="display: flex; gap: 15px;">
                <button class="secondary" id="customPromptCancelBtn" style="flex: 1;">Cancel</button>
                <button class="primary" id="customPromptOkBtn" style="flex: 1;">OK</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
});

window.customAlert = function (message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("customAlertModal");
        const msgEl = document.getElementById("customAlertMessage");
        const btn = document.getElementById("customAlertBtn");

        if (!modal || !msgEl || !btn) {
            console.error("Custom Modal HTML not found, fully falling back.");
            alert(message);
            return resolve();
        }

        msgEl.innerText = message;
        modal.style.display = "flex";

        const onClick = () => {
            modal.style.display = "none";
            btn.removeEventListener("click", onClick);
            resolve();
        };

        btn.addEventListener("click", onClick);
    });
};

window.customConfirm = function (message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("customConfirmModal");
        const msgEl = document.getElementById("customConfirmMessage");
        const okBtn = document.getElementById("customConfirmOkBtn");
        const cancelBtn = document.getElementById("customConfirmCancelBtn");

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            console.error("Custom Confirm HTML not found, fully falling back.");
            return resolve(confirm(message));
        }

        msgEl.innerText = message;
        modal.style.display = "flex";

        const cleanup = () => {
            modal.style.display = "none";
            okBtn.removeEventListener("click", onOk);
            cancelBtn.removeEventListener("click", onCancel);
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
    });
};

window.customPrompt = function (message, defaultValue = "") {
    return new Promise((resolve) => {
        const modal = document.getElementById("customPromptModal");
        const msgEl = document.getElementById("customPromptMessage");
        const inputEl = document.getElementById("customPromptInput");
        const okBtn = document.getElementById("customPromptOkBtn");
        const cancelBtn = document.getElementById("customPromptCancelBtn");

        if (!modal || !msgEl || !inputEl || !okBtn || !cancelBtn) {
            console.error("Custom Prompt HTML not found, fully falling back.");
            return resolve(prompt(message, defaultValue));
        }

        msgEl.innerText = message;
        inputEl.value = defaultValue;
        modal.style.display = "flex";

        setTimeout(() => inputEl.focus(), 10);

        const cleanup = () => {
            modal.style.display = "none";
            okBtn.removeEventListener("click", onOk);
            cancelBtn.removeEventListener("click", onCancel);
            inputEl.removeEventListener("keydown", onKeyDown);
        };

        const onOk = () => { cleanup(); resolve(inputEl.value); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onKeyDown = (e) => {
            if (e.key === "Enter") onOk();
            if (e.key === "Escape") onCancel();
        };

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
        inputEl.addEventListener("keydown", onKeyDown);
    });
};
