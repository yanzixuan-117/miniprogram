// pages/coaches/profile.js
const util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    formData: {
      name: '',
      avatarUrl: '',
      specialty: [],
      introduction: '',
      experience: '',
      status: 1
    },
    tagInput: '',
    suggestions: ['网球基础', '发球技术', '接发球', '底线技术', '网前技术', '战术指导', '体能训练', '心理辅导'],
    saving: false,
    isEdit: false
  },

  onLoad(options) {
    const app = getApp()

    // 检查登录
    if (!app.globalData.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' })
      }, 1500)
      return
    }

    // 检查教练权限
    if (!app.isCoachOrAdmin()) {
      wx.showModal({
        title: '权限提示',
        content: '只有教练才能访问此页面',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return
    }

    this.loadCoachProfile()
  },

  // 加载教练资料
  async loadCoachProfile() {
    try {
      const db = wx.cloud.database()
      const _ = db.command

      // 查询当前用户的教练资料
      const res = await db.collection('coaches').where({
        _openid: _.eq('{openid}')
      }).get()

      if (res.data && res.data.length > 0) {
        const coachInfo = res.data[0]
        this.setData({
          coachId: coachInfo._id,
          formData: {
            name: coachInfo.name || '',
            avatarUrl: coachInfo.avatarUrl || '',
            specialty: coachInfo.specialty || [],
            introduction: coachInfo.introduction || '',
            experience: coachInfo.experience || '',
            status: coachInfo.status !== undefined ? coachInfo.status : 1
          },
          isEdit: true
        })
      }
    } catch (err) {
      util.showError('加载失败')
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      'formData.avatarUrl': avatarUrl
    })
  },

  // 姓名输入
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    })
  },

  // 专长标签输入
  onTagInput(e) {
    this.setData({
      tagInput: e.detail.value
    })
  },

  // 添加标签
  addTag() {
    const tag = this.data.tagInput.trim()
    if (!tag) return

    if (this.data.formData.specialty.length >= 8) {
      util.showToast('最多添加8个专长标签')
      return
    }

    if (this.data.formData.specialty.includes(tag)) {
      util.showToast('该标签已存在')
      return
    }

    this.setData({
      'formData.specialty': [...this.data.formData.specialty, tag],
      tagInput: ''
    })
  },

  // 使用建议标签
  useSuggestion(e) {
    const tag = e.currentTarget.dataset.tag
    if (this.data.formData.specialty.includes(tag)) {
      util.showToast('该标签已存在')
      return
    }

    if (this.data.formData.specialty.length >= 8) {
      util.showToast('最多添加8个专长标签')
      return
    }

    this.setData({
      'formData.specialty': [...this.data.formData.specialty, tag]
    })
  },

  // 删除标签
  removeTag(e) {
    const index = e.currentTarget.dataset.index
    const specialty = [...this.data.formData.specialty]
    specialty.splice(index, 1)
    this.setData({
      'formData.specialty': specialty
    })
  },

  // 简介输入
  onIntroInput(e) {
    this.setData({
      'formData.introduction': e.detail.value
    })
  },

  // 经验输入
  onExperienceInput(e) {
    this.setData({
      'formData.experience': e.detail.value
    })
  },

  // 状态切换
  onStatusChange(e) {
    this.setData({
      'formData.status': e.detail.value ? 1 : 0
    })
  },

  // 保存资料
  async saveProfile() {
    const { formData, isEdit } = this.data

    // 验证必填项
    if (!formData.name.trim()) {
      util.showToast('请输入姓名')
      return
    }

    if (formData.specialty.length === 0) {
      util.showToast('请至少添加一个专长标签')
      return
    }

    this.setData({ saving: true })

    try {
      const db = wx.cloud.database()
      const data = {
        name: formData.name,
        avatarUrl: formData.avatarUrl,
        specialty: formData.specialty,
        introduction: formData.introduction,
        experience: formData.experience,
        status: formData.status,
        updateTime: db.serverDate()
      }

      if (isEdit) {
        // 更新现有记录
        await db.collection('coaches').doc(this.data.coachId).update({
          data
        })
      } else {
        // 创建新记录
        data.rating = '5.0'
        data.reviewCount = 0
        data.createTime = db.serverDate()

        await db.collection('coaches').add({ data })
      }

      util.showSuccess('保存成功')

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      util.showError('保存失败，请重试')
    } finally {
      this.setData({ saving: false })
    }
  }
})
