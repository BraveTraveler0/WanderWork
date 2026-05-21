const { ROLE } = require('./roles.js')



function canViewProject(user, article) {
  return (
    user.role === ROLE.ADMIN ||
    article.username === user.username
  )
}

function scopedProjects(user, article) {
  if (user.role === ROLE.ADMIN) return projects
  return Article.filter(article => article.userId === user.id)
}

function canDeleteProject(user, article) {
  return article.username === user.username
}

function canEditProject(user, article) {
return article.username === user.username
}

module.exports = {
  canViewProject,
  scopedProjects,
  canDeleteProject,
  canEditProject
}