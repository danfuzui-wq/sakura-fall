<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Hoa anh đào rơi 🌸</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      background: #fdf6f6;
      height: 100vh;
    }
    .sakura {
      position: fixed;
      top: -10px;
      width: 15px;
      height: 15px;
      background: pink;
      border-radius: 50%;
      opacity: 0.8;
      pointer-events: none;
      animation: fall linear forwards;
    }
    @keyframes fall {
      to {
        transform: translateY(100vh) rotate(360deg);
        opacity: 0.3;
      }
    }
  </style>
</head>
<body>
  <script>
    function createSakura() {
      const sakura = document.createElement("div");
      sakura.classList.add("sakura");

      // random vị trí, kích thước, tốc độ
      sakura.style.left = Math.random() * window.innerWidth + "px";
      sakura.style.width = sakura.style.height = 10 + Math.random() * 15 + "px";
      sakura.style.animationDuration = 5 + Math.random() * 5 + "s";

      document.body.appendChild(sakura);

      // xóa sau khi rơi xong
      setTimeout(() => {
        sakura.remove();
      }, 10000);
    }

    // 🌸 tăng số lượng bằng cách giảm interval
    setInterval(createSakura, 100); // càng nhỏ thì càng nhiều hoa
  </script>
</body>
</html>
