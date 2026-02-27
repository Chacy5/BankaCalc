(function () {
  // Просто чтобы запоминался город при переходах
  const title = document.title || "";
  if (title.includes("Минск")) localStorage.setItem("banka_city", "minsk");
  if (title.includes("Брест")) localStorage.setItem("banka_city", "brest");
})();