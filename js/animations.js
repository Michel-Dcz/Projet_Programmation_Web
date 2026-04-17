const elements = document.querySelectorAll(".classcontenant");

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("animation-show");
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.15
});

elements.forEach(el =>
    observer.observe(el));