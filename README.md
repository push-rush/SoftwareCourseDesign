# SoftwareCourseDesign
软件综合课程设计

## Theme
科研文献管理系统

## Brief
本系统使用Node.js和Express作为后端，React作为前端，并使用SQLite作为数据库。

## Environment
### 安装工具
* 安装Node.js和npm
    > 下载并安装Node.js: 访问 [Node.js官方网站](https://nodejs.org/zh-cn?spm=5176.28103460.0.0.297c5d27EpGsYd)。
* 验证安装:
    打开终端或命令提示符。
    输入 node -v 和 npm -v 来验证Node.js和npm是否安装成功。

### 创建后端项目
* 创建后端项目目录
    > 创建一个新的文件夹用于存放后端代码。
* 初始化Node.js项目
    > 进入新创建的文件夹，在终端中运行以下命令来初始化一个新的Node.js项目
        ``` npm init -y ```
    > 初始化成功会创建一个``` package.json ```文件
* 安装依赖: 
    > 在后端目录下运行下面命令配置环境 
        ``` npm install express sqlite3 body-parser ```
* 创建后端服务器文件:
    > 在项目目录中创建一个名为``` server.js ```的文件，将此项目下``` backtend/server.js ```粘贴进去即可。
* 启动服务器:
    > 在后端目录中运行
    ``` node server.js ``` 

### 创建前端项目
* 创建前端项目目录:
    > 创建一个新的文件夹用于存放前端代码。
* 创建React应用:
    > 使用下面指令快速搭建React应用
    ``` npx create-react-app . ```
* 安装Axios:
    > 在终端中运行以下命令来安装Axios（用于HTTP请求）等依赖：
    ``` npm install react react-dom axios ```
* 启动前端:
    > 打开``` src/App.js ```，将文件中的内容替换为项目中提供的前端代码 ``` frontend/src/App.js```。
* 启动前端
    > 在前端目录中运行 
    ``` npm start ```