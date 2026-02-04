// pages/video/upload.js
const util = require('../../utils/util.js')

Page({
  data: {
    loading: false,
    uploading: false,
    saving: false,
    uploadProgress: 0,
    tagInput: '',
    categoryIndex: 0,
    difficultyIndex: 0,
    categories: ['技术', '战术', '体能', '比赛', '花絮'],
    difficulties: [
      { value: '1', label: '初级' },
      { value: '2', label: '中级' },
      { value: '3', label: '高级' }
    ],
    difficultyText: '初级',
    suggestions: ['正手', '反手', '发球', '接发球', '截击', '高压球', '步法训练', '比赛分析'],
    formData: {
      title: '',
      description: '',
      category: '技术',
      difficulty: '1',
      videoUrl: '',
      thumbnail: '',
      duration: 0,
      tags: [],
      status: 1
    }
  },

  onLoad() {
    const app = getApp()
    if (!app.globalData.hasLogin) {
      util.showToast('请先登录')
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }, 1500)
      return
    }

    if (!app.isCoachOrAdmin()) {
      util.showToast('需要教练权限')
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1500)
      return
    }
  },

  // 选择视频
  chooseVideo() {
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 60, // 最大60秒（微信限制）
      camera: 'back',
      success: (res) => {
        const { tempFilePath, duration } = res
        this.uploadVideo(tempFilePath, duration)
      },
      fail: (err) => {
        // 忽略错误
      }
    })
  },

  // 上传视频到云存储
  uploadVideo(filePath, duration) {
    this.setData({ uploading: true, uploadProgress: 0 })

    const cloudPath = `videos/${Date.now()}-${Math.random().toString(36).substr(2)}.mp4`

    // 创建上传任务
    const uploadTask = wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          this.setData({
            'formData.videoUrl': res.fileID,
            'formData.duration': duration,
            uploadProgress: 100
          })

          util.showSuccess('视频上传成功')
        } else {
          util.showError('视频上传失败')
        }
      },
      fail: (err) => {
        util.showError('上传失败，请重试')
      },
      complete: () => {
        this.setData({
          uploading: false,
          uploadProgress: 0
        })
      }
    })

    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      this.setData({
        uploadProgress: res.progress
      })
    })
  },

  // 移除视频
  removeVideo() {
    wx.showModal({
      title: '提示',
      content: '确定要移除已上传的视频吗？',
      success: (res) => {
        if (res.confirm) {
          // 删除云存储文件
          if (this.data.formData.videoUrl && this.data.formData.videoUrl.startsWith('cloud://')) {
            wx.cloud.deleteFile({
              fileList: [this.data.formData.videoUrl]
            }).catch(err => {
              // 忽略错误
            })
          }

          this.setData({
            'formData.videoUrl': '',
            'formData.duration': 0
          })
        }
      }
    })
  },

  // 选择封面图
  chooseThumbnail() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.uploadThumbnail(tempFilePath)
      }
    })
  },

  // 上传封面图
  uploadThumbnail(filePath) {
    this.setData({ uploading: true })

    const cloudPath = `thumbnails/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          this.setData({
            'formData.thumbnail': res.fileID
          })
          util.showSuccess('封面上传成功')
        } else {
          util.showError('封面上传失败')
        }
      },
      fail: (err) => {
        util.showError('封面上传失败，请重试')
      },
      complete: () => {
        this.setData({ uploading: false })
      }
    })
  },

  // 移除封面
  removeThumbnail() {
    wx.showModal({
      title: '提示',
      content: '确定要移除已上传的封面吗？',
      success: (res) => {
        if (res.confirm) {
          // 删除云存储文件
          if (this.data.formData.thumbnail && this.data.formData.thumbnail.startsWith('cloud://')) {
            wx.cloud.deleteFile({
              fileList: [this.data.formData.thumbnail]
            }).catch(err => {
              // 忽略错误
            })
          }

          this.setData({
            'formData.thumbnail': '',
            thumbnailGenerated: false
          })
        }
      }
    })
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    })
  },

  // 分类选择
  onCategoryChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      categoryIndex: index,
      'formData.category': this.data.categories[index]
    })
  },

  // 难度选择
  onDifficultyChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      difficultyIndex: index,
      'formData.difficulty': this.data.difficulties[index].value,
      difficultyText: this.data.difficulties[index].label
    })
  },

  // 简介输入
  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    })
  },

  // 标签输入
  onTagInput(e) {
    this.setData({
      tagInput: e.detail.value
    })
  },

  // 添加标签
  addTag() {
    const tag = this.data.tagInput.trim()
    if (!tag) return

    if (this.data.formData.tags.length >= 8) {
      util.showToast('最多添加8个标签')
      return
    }

    if (this.data.formData.tags.includes(tag)) {
      util.showToast('该标签已存在')
      return
    }

    this.setData({
      'formData.tags': [...this.data.formData.tags, tag],
      tagInput: ''
    })
  },

  // 使用建议标签
  useSuggestion(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = [...this.data.formData.tags]

    if (tags.includes(tag)) {
      // 如果已存在，则移除
      const index = tags.indexOf(tag)
      tags.splice(index, 1)
      this.setData({
        'formData.tags': tags
      })
    } else {
      // 如果不存在，则添加
      if (tags.length >= 8) {
        util.showToast('最多添加8个标签')
        return
      }

      this.setData({
        'formData.tags': [...tags, tag]
      })
    }
  },

  // 删除标签
  removeTag(e) {
    const index = e.currentTarget.dataset.index
    const tags = [...this.data.formData.tags]
    tags.splice(index, 1)
    this.setData({
      'formData.tags': tags
    })
  },

  // 状态切换
  onStatusChange(e) {
    this.setData({
      'formData.status': e.detail.value ? 1 : 0
    })
  },

  // 保存
  async save() {
    const { formData } = this.data

    // 验证必填项
    if (!formData.videoUrl) {
      util.showToast('请先上传视频')
      return
    }

    if (!formData.title.trim()) {
      util.showToast('请输入视频标题')
      return
    }

    if (!formData.category) {
      util.showToast('请选择分类')
      return
    }

    if (!formData.difficulty) {
      util.showToast('请选择难度')
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageVideo',
        data: {
          action: 'add',
          videoData: formData
        }
      })

      if (res.result.success) {
        util.showSuccess('发布成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '发布失败')
      }
    } catch (err) {
      util.showError('发布失败，请重试')
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
