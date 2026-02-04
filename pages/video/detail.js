// pages/video/detail.js
var util = require('../../utils/util.js')

Page({
  data: {
    videoId: '',
    video: null,
    loading: true,
    playing: false,
    isLiked: false,
    isFavorited: false,
    showComments: true,
    comments: [],
    commentContent: '',
    loadingComments: false
  },

  onLoad: function(options) {
    var id = options.id
    if (!id) {
      util.showError('视频不存在')
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ videoId: id })
    this.loadVideoDetail()
  },

  // 加载视频详情
  loadVideoDetail: async function() {
    this.setData({ loading: true })

    try {
      var res = await wx.cloud.callFunction({
        name: 'manageVideo',
        data: {
          action: 'get',
          videoId: this.data.videoId
        }
      })

      if (res.result.success) {
        var video = res.result.data

        // 格式化数据 - 手动复制对象
        var formattedVideo = {}
        for (var key in video) {
          formattedVideo[key] = video[key]
        }
        formattedVideo.durationText = this.formatDuration(video.duration)
        formattedVideo.difficultyText = this.getDifficultyText(video.difficulty)

        this.setData({
          video: formattedVideo
        })

        // 设置标题
        wx.setNavigationBarTitle({
          title: video.title || '视频详情'
        })

        // 检查点赞和收藏状态
        this.checkLikeStatus()
        this.checkFavoriteStatus()

        // 加载评论列表
        this.loadComments()
      } else {
        util.showError(res.result.message || '加载失败')
        setTimeout(function() {
          wx.navigateBack()
        }, 1500)
      }
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 检查点赞状态
  checkLikeStatus: async function() {
    try {
      var res = await wx.cloud.callFunction({
        name: 'manageLikes',
        data: {
          action: 'check',
          videoId: this.data.videoId
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          isLiked: res.result.data.isLiked
        })
      }
    } catch (err) {
      // 云函数未部署时静默处理
    }
  },

  // 检查收藏状态
  checkFavoriteStatus: async function() {
    try {
      var res = await wx.cloud.callFunction({
        name: 'manageFavorites',
        data: {
          action: 'check',
          videoId: this.data.videoId
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          isFavorited: res.result.data.isFavorited
        })
      }
    } catch (err) {
      // 云函数未部署时静默处理
    }
  },

  // 格式化时长
  formatDuration: function(seconds) {
    return util.formatDuration(seconds)
  },

  // 格式化评论时间
  formatCommentTime: function(date) {
    return util.formatRelativeTime(date)
  },

  // 获取难度文本
  getDifficultyText: function(difficulty) {
    return util.getDifficultyText(difficulty)
  },

  // 视频播放状态
  onPlay: function() {
    this.setData({ playing: true })
  },

  // 视频暂停
  onPause: function() {
    this.setData({ playing: false })
  },

  // 视频播放结束
  onEnded: function() {
    this.setData({ playing: false })
  },

  // 点击封面播放视频
  onTapCover: function() {
    var videoContext = wx.createVideoContext('videoPlayer', this)
    videoContext.play()
  },

  // 点赞
  onLike: async function() {
    var action = this.data.isLiked ? 'remove' : 'add'

    try {
      var res = await wx.cloud.callFunction({
        name: 'manageLikes',
        data: {
          action: action,
          videoId: this.data.videoId
        }
      })

      if (res.result && res.result.success) {
        var isLiked = action === 'add'
        var likeCount = (this.data.video.likeCount || 0) + (isLiked ? 1 : -1)
        var updatedVideo = this.data.video
        updatedVideo.likeCount = likeCount

        this.setData({
          isLiked: isLiked,
          video: updatedVideo
        })
        util.showSuccess(isLiked ? '点赞成功' : '取消点赞成功')
      } else {
        var message = res.result && res.result.message ? res.result.message : '操作失败'
        util.showToast(message)
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf('FUNCTION_NOT_FOUND') !== -1) {
        util.showToast('云函数未部署，请先部署 manageLikes')
      } else {
        util.showToast('操作失败，请重试')
      }
    }
  },

  // 收藏
  onFavorite: async function() {
    var action = this.data.isFavorited ? 'remove' : 'add'

    try {
      var res = await wx.cloud.callFunction({
        name: 'manageFavorites',
        data: {
          action: action,
          videoId: this.data.videoId
        }
      })

      if (res.result && res.result.success) {
        var isFavorited = action === 'add'
        this.setData({
          isFavorited: isFavorited
        })
        util.showSuccess(isFavorited ? '收藏成功' : '取消收藏成功')
      } else {
        var message = res.result && res.result.message ? res.result.message : '操作失败'
        util.showToast(message)
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf('FUNCTION_NOT_FOUND') !== -1) {
        util.showToast('云函数未部署，请先部署 manageFavorites')
      } else {
        util.showToast('操作失败，请重试')
      }
    }
  },

  // 分享
  onShare: function() {
    // TODO: 实现分享功能
    util.showToast('分享功能开发中')
  },

  // 查看评论（滚动到评论区）
  onViewComments: function() {
    wx.pageScrollTo({
      selector: '.comments-section',
      duration: 300
    })
  },

  // 关闭评论
  onCloseComments: function() {
    // 收起评论区（滚动到页面顶部）
    wx.pageScrollTo({
      selector: '.video-info',
      duration: 300
    })
  },

  // 加载评论列表
  loadComments: async function() {
    if (this.data.loadingComments) return

    this.setData({ loadingComments: true })

    try {
      var res = await wx.cloud.callFunction({
        name: 'manageComments',
        data: {
          action: 'getList',
          videoId: this.data.videoId
        }
      })

      if (res.result && res.result.success) {
        // 格式化评论时间
        var rawData = res.result.data || []
        var comments = []
        for (var i = 0; i < rawData.length; i++) {
          var item = rawData[i]
          var comment = {}
          for (var key in item) {
            comment[key] = item[key]
          }
          comment.createTimeText = this.formatCommentTime(item.createTime)
          comments.push(comment)
        }

        this.setData({
          comments: comments
        })
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf('FUNCTION_NOT_FOUND') !== -1) {
        util.showToast('评论云函数未部署，请先部署 manageComments')
      }
    } finally {
      this.setData({ loadingComments: false })
    }
  },

  // 评论内容输入
  onCommentInput: function(e) {
    this.setData({
      commentContent: e.detail.value
    })
  },

  // 发表评论
  onPostComment: async function() {
    var content = this.data.commentContent.trim()

    if (!content) {
      util.showToast('请输入评论内容')
      return
    }

    try {
      var res = await wx.cloud.callFunction({
        name: 'manageComments',
        data: {
          action: 'add',
          videoId: this.data.videoId,
          content: content
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          commentContent: ''
        })
        util.showSuccess('评论成功')
        // 重新加载评论列表
        await this.loadComments()
      } else {
        var message = res.result && res.result.message ? res.result.message : '评论失败'
        util.showToast(message)
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf('FUNCTION_NOT_FOUND') !== -1) {
        util.showToast('评论云函数未部署，请先部署 manageComments')
      } else {
        util.showToast('评论失败，请重试')
      }
    }
  },

  // 删除评论
  onDeleteComment: async function(e) {
    var id = e.currentTarget.dataset.id
    var self = this

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评论吗？',
      success: async function(res) {
        if (res.confirm) {
          try {
            var deleteRes = await wx.cloud.callFunction({
              name: 'manageComments',
              data: {
                action: 'delete',
                commentId: id
              }
            })

            if (deleteRes.result && deleteRes.result.success) {
              util.showSuccess('删除成功')
              // 重新加载评论列表
              await self.loadComments()
            } else {
              var message = deleteRes.result && deleteRes.result.message ? deleteRes.result.message : '删除失败'
              util.showToast(message)
            }
          } catch (err) {
            if (err.errMsg && err.errMsg.indexOf('FUNCTION_NOT_FOUND') !== -1) {
              util.showToast('评论云函数未部署，请先部署 manageComments')
            } else {
              util.showToast('删除失败，请重试')
            }
          }
        }
      }
    })
  },

  // 关注作者
  onFollowAuthor: async function() {
    util.showToast('关注功能开发中')
  },

  // 联系教练
  onContactCoach: function() {
    util.showToast('联系功能开发中')
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadVideoDetail()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 分享配置
  onShareAppMessage: function() {
    var video = this.data.video
    var title = video && video.title ? video.title : '网球教学视频'
    var thumbnail = video && video.thumbnail ? video.thumbnail : ''
    return {
      title: title,
      path: '/pages/video/detail?id=' + this.data.videoId,
      imageUrl: thumbnail
    }
  }
})
