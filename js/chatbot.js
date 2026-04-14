const chatBtn = document.getElementById('chat-button');
const sidebar = document.getElementById('chat-sidebar');

chatBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    chatBtn.classList.toggle('active');
});

document.addEventListener('keydown', (event) => {
    if (event.key === "Escape" && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        chatBtn.classList.remove('active');
    }
});