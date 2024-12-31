import React, { useState, useRef, useEffect } from "react";

const MaskOperate = () => {
  const [folderName, setFolderName] = useState(""); // 文件夹名
  const [images, setImages] = useState([]); // 存储图片列表
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // 当前显示的图片索引
  const [currentCategory, setCurrentCategory] = useState("Category 1"); // 当前类别
  const [lineWidth, setLineWidth] = useState(0.3); // 默认边框宽度
  const [isDrawing, setIsDrawing] = useState(false); // 是否在绘制
  const [startPosition, setStartPosition] = useState(null); // 起始点
  const [imageBoxes, setImageBoxes] = useState({}); // 每张图片的框信息
  const canvasRef = useRef(null); // Canvas引用

  // 定义类别与颜色的映射
  const categoryColors = {
    "Category 1": "rgba(255, 0, 0, 0.3)", // 红色填充
    "Category 2": "rgba(0, 255, 0, 0.3)", // 绿色填充
    "Category 3": "rgba(0, 0, 255, 0.3)", // 蓝色填充
  };

  // 获取当前图片的框数据
  const currentImage = images[currentImageIndex];
  const currentBoxes = imageBoxes[currentImage?.name] || [];

  // 上传文件夹并解析
  const handleFolderUpload = (e) => {
    const files = Array.from(e.target.files);

    // 提取文件夹名
    const path = files[0]?.webkitRelativePath || "";
    const folder = path.split("/")[0]; // 提取文件夹名称
    setFolderName(folder);

    // 筛选图片文件和 JSON 文件
    const imageFiles = files.filter(
      (file) => file.type === "image/jpeg" || file.type === "image/png"
    );
    const jsonFiles = files.filter((file) => file.name.endsWith(".json"));

    // 对图片文件名进行数字逻辑排序
    const sortedFiles = imageFiles.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );

    // 将图片文件转为URL列表
    const imageUrls = sortedFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setImages(imageUrls);

    // 初始化框数据
    setImageBoxes((prev) =>
      imageUrls.reduce((acc, img) => {
        acc[img.name] = prev[img.name] || []; // 保留原来的框数据
        return acc;
      }, {})
    );

    // 解析 JSON 文件
    jsonFiles.forEach((jsonFile) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const jsonData = JSON.parse(event.target.result);

        // 将解析出的框数据添加到对应图片
        const fileName = jsonFile.name.replace(".json", ".jpg"); // 假设 JSON 文件名和图片文件名匹配
        if (imageUrls.some((img) => img.name === fileName)) {
          setImageBoxes((prev) => ({
            ...prev,
            [fileName]: jsonData.map((box) => ({
              ...box,
              color: categoryColors[box.category] || "rgba(128, 128, 128, 0.3)", // 设置颜色
            })),
          }));
        }
      };
      reader.readAsText(jsonFile);
    });
  };

  // 处理Canvas点击事件
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!isDrawing) {
      // 第一次点击，记录起始点
      setStartPosition({ x, y });
      setIsDrawing(true);
    } else {
      // 第二次点击，绘制矩形框
      const endPosition = { x, y };
      const newBox = {
        x: Math.min(startPosition.x, endPosition.x), // 矩形起点X
        y: Math.min(startPosition.y, endPosition.y), // 矩形起点Y
        width: Math.abs(endPosition.x - startPosition.x), // 矩形宽度
        height: Math.abs(endPosition.y - startPosition.y), // 矩形高度
        category: currentCategory,
        color: categoryColors[currentCategory], // 填充颜色
        lineWidth,
      };

      setImageBoxes((prev) => ({
        ...prev,
        [currentImage.name]: [...currentBoxes, newBox], // 保存到当前图片的框数据
      }));
      setIsDrawing(false); // 结束绘制
    }
  };

  // 绘制Canvas内容
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 清空Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制当前图片
    if (currentImage) {
      const img = new Image();
      img.src = currentImage.url;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 绘制当前图片的框
        currentBoxes.forEach((box) => {
          ctx.fillStyle = box.color; // 设置填充颜色
          ctx.strokeStyle = "black"; // 边框颜色
          ctx.lineWidth = box.lineWidth; // 边框宽度

          ctx.fillRect(box.x, box.y, box.width, box.height); // 填充矩形
          ctx.strokeRect(box.x, box.y, box.width, box.height); // 绘制矩形边框
        });
      };
    }
  };

  // 更新Canvas内容
  useEffect(() => {
    drawCanvas();
  }, [currentImage, currentBoxes]);

  // 切换到上一张图片
  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex((prevIndex) => prevIndex - 1);
    }
  };

  // 切换到下一张图片
  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex((prevIndex) => prevIndex + 1);
    }
  };

  // 撤回功能
  const handleUndo = () => {
    setImageBoxes((prev) => ({
      ...prev,
      [currentImage.name]: currentBoxes.slice(0, -1), // 删除最后一个框
    }));
  };

  // 导出位置信息为 JSON 文件
  const handleExport = () => {
    // 按类别分组
    const groupedBoxes = currentBoxes.reduce((acc, box) => {
      if (!acc[box.category]) acc[box.category] = [];
      acc[box.category].push({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
      return acc;
    }, {});

    const jsonContent = JSON.stringify(groupedBoxes, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentImage.name.split(".")[0]}.json`; // 文件名为图片名
    link.click();
  };

  return (
    <div style={{ display: "flex", padding: "20px" }}>
      {/* 左侧控制区域 */}
      <div style={{ width: "30%", paddingRight: "20px" }}>
        <h3>上传文件夹</h3>
        <input
          type="file"
          webkitdirectory="true"
          multiple
          onChange={handleFolderUpload}
        />
        {folderName && <p>文件夹名：{folderName}</p>}
        <h3>选择类别</h3>
        <select
          value={currentCategory}
          onChange={(e) => setCurrentCategory(e.target.value)}
        >
          <option value="Category 1">Category 1</option>
          <option value="Category 2">Category 2</option>
          <option value="Category 3">Category 3</option>
        </select>
        <h3>设置边框宽度</h3>
        <input
          type="number"
          value={lineWidth}
          onChange={(e) => setLineWidth(parseFloat(e.target.value))}
          min={0.1}
          step={0.1}  // 允许用户以0.1为步长输入小数
        />
        <button onClick={handleUndo} style={{ marginTop: "10px" }}>
          撤回
        </button>
        <button onClick={handleExport} style={{ marginTop: "10px" }}>
          导出JSON
        </button>
      </div>

      {/* 中间Canvas绘图区 */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: "10px" }}>
          <button onClick={handlePreviousImage} disabled={currentImageIndex === 0}>
            上一张
          </button>
          <button
            onClick={handleNextImage}
            disabled={currentImageIndex === images.length - 1}
            style={{ marginLeft: "10px" }}
          >
            下一张
          </button>
        </div>
        {currentImage && <p>当前图片名：{currentImage.name}</p>}
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{ border: "1px solid black" }}
          onClick={handleCanvasClick}
        ></canvas>
      </div>

      {/* 右侧显示区域 */}
      <div style={{ width: "30%", paddingLeft: "20px" }}>
        <h3>已绘制框信息</h3>
        <ul>
          {currentBoxes.map((box, index) => (
            <li key={index} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: box.color,
                  marginRight: "10px",
                }}
              ></div>
              <span>
                {box.category}: ({box.x.toFixed(0)}, {box.y.toFixed(0)}) -{" "}
                {box.width.toFixed(0)}x{box.height.toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MaskOperate;
