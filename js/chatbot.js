const chatBtn = document.getElementById('chat-button');
const sidebar = document.getElementById('chat-sidebar');
const input = document.querySelector('#user-input');
const chatcontent = document.querySelector('.chat-content');

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

document.addEventListener('keydown', (event) => {
    if (event.key === "Enter" && sidebar.classList.contains('active')) {
        let div = document.createElement('div');
        div.setAttribute('class', 'userquestion');
        var question = input.value;
        let p = document.createElement('p');
        p.textContent = question;
        div.appendChild(p);
        chatcontent.appendChild(div);
        input.value = '';
        response(question);
    }
})

function response(input) {
    let div = document.createElement('div');
        div.setAttribute('class', 'chatresponse');
        let p = document.createElement('p');
        p.textContent = 'réponsetest';
    let tail = document.createElement('span');
    tail.setAttribute('class', 'tail');
    div.appendChild(tail);
        div.appendChild(p);
        chatcontent.appendChild(div);
}

document.addEventListener('click', (event) => {
    if (
        sidebar.classList.contains('active') &&
        !sidebar.contains(event.target) &&
        !chatBtn.contains(event.target)
    ) {
        sidebar.classList.remove('active');
        chatBtn.classList.remove('active');
    }
});