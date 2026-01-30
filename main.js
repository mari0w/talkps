const { entrypoints } = require("uxp");
const { app, core, action } = require("photoshop");

const { batchPlay } = action;

function renderPanel(rootNode) {
  rootNode.innerHTML = `
    <style>
      .wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        font-family: "Avenir Next", "Avenir", "Helvetica Neue", sans-serif;
        background: linear-gradient(135deg, #f7f2f2 0%, #fbe9e7 100%);
        border-radius: 10px;
        animation: rise 220ms ease-out;
      }
      @keyframes rise {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .title {
        font-size: 14px;
        font-weight: 600;
        margin: 0;
      }
      .status {
        font-size: 12px;
        color: #666;
        margin: 0;
      }
      button {
        height: 32px;
        border: none;
        border-radius: 6px;
        background: #c62828;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    </style>
    <div class="wrap">
      <p class="title">Red Background</p>
      <p id="status" class="status">Ready</p>
      <button id="makeRed">Set canvas red</button>
    </div>
  `;

  const button = rootNode.querySelector("#makeRed");
  const status = rootNode.querySelector("#status");

  button.addEventListener("click", async () => {
    if (!app.documents.length) {
      status.textContent = "No document open";
      return;
    }

    button.disabled = true;
    status.textContent = "Applying...";

    try {
      await core.executeAsModal(async () => {
        await batchPlay([
          {
            _obj: "make",
            _target: [{ _ref: "contentLayer" }],
            using: {
              _obj: "contentLayer",
              name: "Red Background",
              type: {
                _obj: "solidColorLayer",
                color: { _obj: "RGBColor", red: 255, green: 0, blue: 0 }
              }
            },
            _options: { dialogOptions: "dontDisplay" }
          },
          {
            _obj: "move",
            _target: [
              { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
            ],
            to: { _ref: "layer", _enum: "ordinal", _value: "last" },
            adjustment: false
          }
        ]);
      }, { commandName: "Set Red Background" });

      status.textContent = "Done";
    } catch (error) {
      console.error(error);
      status.textContent = "Failed. See Console.";
    } finally {
      button.disabled = false;
    }
  });
}

entrypoints.setup({
  panels: {
    redBackgroundPanel: {
      create(rootNode) {
        renderPanel(rootNode);
      }
    }
  }
});
