import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AllocationForm from './AllocationForm';
import { BrowserRouter as Router, Route, Routes, Link, useParams } from 'react-router-dom';
import { marked } from 'marked'; // 命名导入 marked
import mammoth from 'mammoth'; // 导入 mammoth 处理 docx 文件

import styled from 'styled-components';

import * as pdfjsLib from 'pdfjs-dist'; // 使用命名导出
import pdfWorkerEntry from 'pdfjs-dist/build/pdf.worker.entry';
// 设置 PDFJS worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerEntry;

// 提取出表单输入框和按钮的通用样式
const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px;
  background-color: #f7f7f7;
  border-radius: 8px;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  margin: auto;
`;

const Input = styled.input`
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  &:focus {
    border-color: #007bff;
    outline: none;
  }
`;

const Button = styled.button`
  padding: 10px 20px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: #0056b3;
  }
`;

const Title = styled.h1`
  text-align: center;
  font-size: 28px;
  margin-bottom: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  th, td {
    padding: 10px;
    text-align: left;
    border: 1px solid #ddd;
  }
  th {
    background-color: #f4f4f4;
  }
`;

const TableButton = styled.button`
  padding: 5px 10px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background-color: #218838;
  }
`;

const FormTitle = styled.h2`
  margin-bottom: 15px;
  font-size: 22px;
`;

function Preview() {
  const { filename } = useParams();
  const [fileType, setFileType] = useState('');
  const [fileContent, setFileContent] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/preview/${filename}`, {
          responseType: 'arraybuffer',
        });
        const contentType = response.headers['content-type'];
        setFileType(contentType);

        if (contentType.startsWith('image/') || contentType === 'application/pdf') {
          // alert("显示image");

          setFileContent(URL.createObjectURL(new Blob([response.data], { type: contentType })));
        } else if (contentType === 'text/plain' || contentType === 'text/markdown') {
          // alert("显示markdown文档");

          const textDecoder = new TextDecoder('utf-8');
          setFileContent(textDecoder.decode(response.data));
        } else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // alert("显示docx文档");

          const arrayBuffer = response.data;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setFileContent(result.value);
        }
      } catch (error) {
        console.error('Error fetching file:', error);
      }
    };

    fetchFile();
  }, [filename]);

  useEffect(() => {
    if (fileType === 'application/pdf' && fileContent) {
      const renderPage = async (num) => {
        const loadingTask = pdfjsLib.getDocument(fileContent);
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);
        const page = await pdf.getPage(num);
        const viewport = page.getViewport({ scale: 1.5 });

        // 创建一个新的 canvas 元素
        const canvasId = `pdf-canvas-${num}`;
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.style.width = '100%';
        canvas.style.height = '600px';
        canvas.style.marginTop = '20px';

        // 替换旧的 canvas 元素
        const container = document.querySelector('.pdf-container');
        const oldCanvas = document.getElementById(canvasId);
        if (oldCanvas) {
          container.replaceChild(canvas, oldCanvas);
        } else {
          container.appendChild(canvas);
        }

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      };

      renderPage(pageNumber);
    }
  }, [pageNumber, fileType, fileContent]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto' }}>
      <h1>文件预览</h1>
      <Link to="/">返回主页</Link>
      {fileType.startsWith('image/') && fileContent && (
        <img src={fileContent} alt="Preview" style={{ width: '100%', marginTop: '20px' }} />
      )}
      {fileType === 'application/pdf' && fileContent && (
        <div className="pdf-container">
          {/* PDF 渲染区域 */}
        </div>
      )}
      {(fileType === 'text/plain' || fileType === 'text/markdown') && fileContent && (
        <div style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
          {fileType === 'text/markdown' ? (
            <div dangerouslySetInnerHTML={{ __html: marked.parse(fileContent) }} />
          ) : (
            <pre>{fileContent}</pre>
          )}
        </div>
      )}
      {fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && fileContent && (
        <div dangerouslySetInnerHTML={{ __html: fileContent }} style={{ marginTop: '20px', overflowY: 'scroll', maxHeight: '600px', border: '1px solid #ccc', padding: '10px' }} />
      )}
      {fileType === 'application/pdf' && fileContent && (
        <div>
          <p>
            Page {pageNumber} of {numPages}
          </p>
          <button onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))} disabled={pageNumber <= 1}>
            Previous
          </button>
          <button onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))} disabled={pageNumber >= numPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [literatures, setLiteratures] = useState([]);
  const [filteredLiteratures, setFilteredLiteratures] = useState([]);
  const [newLiterature, setNewLiterature] = useState({ title: '', description: '', source: '', year: '', author: '', unit: '' });
  const [file, setFile] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [searchQuery, setSearchQuery] = useState({ title: '', author: '' });
  const [hasSearched, setHasSearched] = useState(false); // 新增状态来判断是否已经进行过搜索
  const [allocations, setAllocations] = useState([]);
  const [newAllocation, setNewAllocation] = useState({ userId: '', literatureId: '', meetingTime: '' });
  const [notes, setNotes] = useState('');
  const [slidesFile, setSlidesFile] = useState(null);
  const [users, setUsers] = useState([]);
  const [allocationsDetail, setAllocationsDetail] = useState([]);

  useEffect(() => {
    fetchUsers(); // 获取用户列表以便在分配文献时选择
    fetchLiteratures();
    fetchAllocations(); //获取分配的文献
    fetchAllocationDetails(); // 获取所有的文献分配信息
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:3000/login', { username, password });
      if (response.data.success) {
        setUser(response.data.user);
        alert('登录成功'); // 提示用户登录成功
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      alert('登录失败，请检查用户名和密码');
    }
  };

  const register = async (username, password, confirmPassword, role) => {
    try {
      const response = await axios.post('http://localhost:3000/register', { username, password, confirmPassword, role });
      if (response.data.success) {
        alert('注册成功'); // 提示用户注册成功
        setShowRegisterForm(false); // 关闭注册表单
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      alert('注册失败，请检查输入');
    }
  };

  const changePassword = async () => {
    try {
      const { oldPassword, newPassword, confirmPassword } = passwords;
      const response = await axios.post('http://localhost:3000/change-password', { userId: user.id, oldPassword, newPassword, confirmPassword });
      if (response.data.success) {
        alert('密码修改成功'); // 提示用户密码修改成功
        setShowChangePasswordForm(false); // 关闭密码修改表单
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      alert('密码修改失败，请检查输入');
    }
  };

  const fetchLiteratures = async () => {
    try {
      const response = await axios.get('http://localhost:3000/literatures');
      setLiteratures(response.data);
      setFilteredLiteratures(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const addLiterature = async () => {
    try {
      const formData = new FormData();
      formData.append('title', newLiterature.title);
      formData.append('description', newLiterature.description);
      formData.append('source', newLiterature.source);
      formData.append('year', newLiterature.year);
      formData.append('author', newLiterature.author);
      formData.append('unit', newLiterature.unit);
      formData.append('file', file);

      const response = await axios.post('http://localhost:3000/upload-literature', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      fetchLiteratures();
      setNewLiterature({ title: '', description: '', source: '', year: '', author: '', unit: '' });
      setFile(null);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteLiterature = async (id) => {
    try {
      await axios.delete(`http://localhost:3000/literatures/${id}`);
      fetchLiteratures();
    } catch (error) {
      console.error(error);
    }
  };

  const updateLiterature = async (id, updatedData) => {
    try {
      await axios.put(`http://localhost:3000/literatures/${id}`, updatedData);
      fetchLiteratures();
    } catch (error) {
      console.error(error);
    }
  };

  const searchLiteratures = async () => {
    try {
      const response = await axios.get('http://localhost:3000/search', {
        params: searchQuery,
      });
      setLiteratures(response.data);
      setFilteredLiteratures(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAllocations = async () => {
    try {
      const response = await axios.get('http://localhost:3000/allocations');
      setAllocations(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const allocateLiterature = async () => {
    try {
      const response = await axios.post('http://localhost:3000/allocate-literature', newAllocation);
      if (response.data.success) {
        fetchAllocations();
        fetchAllocationDetails(); // 获取所有的文献分配信息
        setNewAllocation({ userId: '', literatureId: '', meetingTime: '' });
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const updateAllocation = async (allocationId) => {
    try {
      const formData = new FormData();
      formData.append('notes', notes);
      if (slidesFile) {
        formData.append('slidesFile', slidesFile);
      }

      const response = await axios.put(`http://localhost:3000/allocations/${allocationId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        fetchAllocations();
        fetchAllocationDetails(); // 获取所有的文献分配信息
        setNotes('');
        setSlidesFile(null);
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:3000/users');
      setUsers(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAllocationDetails = async (allocationId) => {
    try {
      const response = await axios.get(`http://localhost:3000/get-allocations`);
      setAllocationsDetail(response.data);
    } catch (error) {
      console.error(error);
      alert('Failed to fetch allocation details');
      return null;
    }
  };
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div 
          style={{ 
            minHeight: '100vh',
            color: '#FFFFFF', // 设置字体颜色为白色
            fontFamily: 'Arial, sans-serif', // 设置字体
            minHeight: '100vh',
            backgroundSize: '400% 400%',
            animation: 'gradientAnimation 15s ease infinite',
            background: 'linear-gradient(135deg, #2f2f2f, #4a4a4a)', // 深灰到浅灰渐变
          }}
          >
          <div style={{ width: '100%', maxWidth: '1920px', textAlign: 'center', marginTop: '20px' }}>
            {/* 欢迎语 */}
            <h2 style={{ margin: '0', padding: '20px', fontSize: '2rem' }}>
              科研文献管理系统
            </h2>
            <h2 style={{ margin: '0', padding: '16px', fontSize: '1rem' }}>
              很高兴与你相遇~
            </h2>
          </div>
          <div>

          <Routes>
            <Route path="/" element={<div></div>} />
          </Routes>
          </div>
            {!user && (
              <FormContainer>
                <Title>登录</Title>
                <Input
                  type="text"
                  placeholder="用户名"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder="密码"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <Button onClick={() => login(newUser.username, newUser.password)}>登录</Button>
                <Button onClick={() => setShowRegisterForm(true)}>注册</Button>
              </FormContainer>
            )}
            {showRegisterForm && (
              <FormContainer>
                <FormTitle>注册</FormTitle>
                <Input
                  type="text"
                  placeholder="用户名"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder="密码"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder="确认密码"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
                <Button onClick={() => register(newUser.username, newUser.password, newUser.confirmPassword, newUser.role)}>注册</Button>
                <Button onClick={() => setShowRegisterForm(false)}>取消</Button>
              </FormContainer>
            )}
            {user && (
              <div>
                <Title>欢迎, {user.username}</Title>
                <Button onClick={() => setUser(null)}>登出</Button>
                <Button onClick={() => setShowChangePasswordForm(true)}>修改密码</Button>
                {showChangePasswordForm && (
                  <FormContainer>
                    <FormTitle>修改密码</FormTitle>
                    <Input
                      type="password"
                      placeholder="旧密码"
                      value={passwords.oldPassword}
                      onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="新密码"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="确认新密码"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    />
                    <Button onClick={changePassword}>修改密码</Button>
                    <Button onClick={() => setShowChangePasswordForm(false)}>取消</Button>
                  </FormContainer>
                )}
                {user.role === 'admin' && (
                  <div>
                    <FormTitle>添加文献</FormTitle>
                    <Input
                      type="text"
                      placeholder="标题"
                      value={newLiterature.title}
                      onChange={(e) => setNewLiterature({ ...newLiterature, title: e.target.value })}
                    />
                    <Input
                      type="text"
                      placeholder="简介"
                      value={newLiterature.description}
                      onChange={(e) => setNewLiterature({ ...newLiterature, description: e.target.value })}
                    />
                    <Input
                      type="text"
                      placeholder="出处"
                      value={newLiterature.source}
                      onChange={(e) => setNewLiterature({ ...newLiterature, source: e.target.value })}
                    />
                    <Input
                      type="text"
                      placeholder="年份"
                      value={newLiterature.year}
                      onChange={(e) => setNewLiterature({ ...newLiterature, year: e.target.value })}
                    />
                    <Input
                      type="text"
                      placeholder="作者"
                      value={newLiterature.author}
                      onChange={(e) => setNewLiterature({ ...newLiterature, author: e.target.value })}
                    />
                    <Input
                      type="text"
                      placeholder="单位"
                      value={newLiterature.unit}
                      onChange={(e) => setNewLiterature({ ...newLiterature, unit: e.target.value })}
                    />
                    <Input
                      type="file"
                      accept=".pdf,.docx,.pdf,.docx"
                      onChange={(e) => setFile(e.target.files[0])}
                    />
                    <Button onClick={addLiterature}>添加</Button>

                    <FormTitle>文献分配</FormTitle>
                    <select
                      value={newAllocation.userId}
                      onChange={(e) => setNewAllocation({ ...newAllocation, userId: e.target.value })}
                    >
                      <option value="">选择用户</option>
                      {users.map((userItem) => (
                        <option key={userItem.id} value={userItem.id}>
                          {userItem.username}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newAllocation.literatureId}
                      onChange={(e) => setNewAllocation({ ...newAllocation, literatureId: e.target.value })}
                    >
                      <option value="">选择文献</option>
                      {literatures.map((lit) => (
                        <option key={lit.id} value={lit.id}>
                          {lit.title}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="datetime-local"
                      value={newAllocation.meetingTime}
                      onChange={(e) => setNewAllocation({ ...newAllocation, meetingTime: e.target.value })}
                    />
                    <Button onClick={allocateLiterature}>分配</Button>
                  </div>
                )}

                <FormTitle>查询文献</FormTitle>
                <Input
                  type="text"
                  placeholder="标题"
                  value={searchQuery.title}
                  onChange={(e) => setSearchQuery({ ...searchQuery, title: e.target.value })}
                />
                <Input
                  type="text"
                  placeholder="作者"
                  value={searchQuery.author}
                  onChange={(e) => setSearchQuery({ ...searchQuery, author: e.target.value })}
                />
                <Button onClick={searchLiteratures}>搜索</Button>

                <FormTitle>文献列表</FormTitle>
                <Table>
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>简介</th>
                      <th>出处</th>
                      <th>年份</th>
                      <th>作者</th>
                      <th>单位</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {literatures.map((lit) => (
                      <tr key={lit.id}>
                        <td>{lit.title}</td>
                        <td>{lit.description}</td>
                        <td>{lit.source}</td>
                        <td>{lit.year}</td>
                        <td>{lit.author}</td>
                        <td>{lit.unit}</td>
                        <td>
                          <Link to={`/preview/${encodeURIComponent(lit.file)}`}>查看</Link>
                          <a
                            href={`http://localhost:3000/files/${encodeURIComponent(lit.file)}`}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            下载
                          </a>
                          {user.role === 'admin' && (
                            <>
                              <TableButton onClick={() => deleteLiterature(lit.id)}>删除</TableButton>
                              <TableButton
                                onClick={() =>
                                  updateLiterature(lit.id, { ...lit, title: prompt('新标题', lit.title) })
                                }
                              >
                                修改
                              </TableButton>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {user.role === 'user' && (
                  <>
                    <FormTitle>我的文献分配</FormTitle>
                    <Table>
                      <thead>
                        <tr>
                          <th>文献标题</th>
                          <th>作者</th>
                          <th>年份</th>
                          <th>会议时间</th>
                          <th>心得</th>
                          <th>总结</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations
                          .filter((allocation) => allocation.userId === user.id)
                          .map((allocation) => (
                            <tr key={allocation.id}>
                              <td>{allocation.literatureTitle}</td>
                              <td>{allocation.literatureAuthor}</td>
                              <td>{allocation.literatureYear}</td>
                              <td>{new Date(allocation.meetingTime).toLocaleString()}</td>
                              <td>
                                <Input
                                  type="file"
                                  accept=".pdf,.docx"
                                  onChange={(e) => setNotes(e.target.files[0])}
                                />
                              </td>
                              <td>
                                <Input
                                  type="file"
                                  accept=".pdf,.docx"
                                  onChange={(e) => setSlidesFile(e.target.files[0])}
                                />
                              </td>
                              <td>
                                <Button onClick={() => updateAllocation(allocation.id)}>更新心得/课件</Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  </>
                )}

                <FormTitle>分配文献信息</FormTitle>
                <Table>
                  <thead>
                    <tr>
                      <th>文献标题</th>
                      <th>作者</th>
                      <th>年份</th>
                      <th>会议时间</th>
                      <th>分配到的人</th>
                      <th>心得</th>
                      <th>总结</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationsDetail.map((allocation) => (
                      <tr key={allocation.id}>
                        <td>{allocation.literatureTitle}</td>
                        <td>{allocation.literatureAuthor}</td>
                        <td>{allocation.literatureYear}</td>
                        <td>{new Date(allocation.meetingTime).toLocaleString()}</td>
                        <td>{allocation.userName}</td>
                        <td>
                          {allocation.notes ? (
                            <div dangerouslySetInnerHTML={{ __html: allocation.notes.replace(/\n/g, '<br>') }} />
                          ) : (
                            'No notes uploaded'
                          )}
                        </td>
                        <td>
                          {allocation.slidesFilename ? (
                            <a
                              href={`/uploads/${allocation.slidesFilename}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Download Slides
                            </a>
                          ) : (
                            'No slides uploaded'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        } />
        <Route path="/preview/:filename" element={<Preview />} />
      </Routes>
    </Router>
  );
}

export default App;