const button = document.querySelector("#reloadRenderer");
const message = document.querySelector("#recoveryMessage");

button.addEventListener("click", async () => {
  button.disabled = true;
  message.textContent = "画面を再読み込みしています…";
  const result = await window.hub.reloadRenderer();
  if (!result?.ok) {
    button.disabled = false;
    message.textContent = "再読み込みできませんでした。アプリを再起動してください。";
  }
});
