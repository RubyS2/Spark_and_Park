module.exports = {
  apps: [{
    name: "spark-park",
    script: "npm",
    args: "run dev",
    cwd: "/home/spark/park-spark-react",
    env: {
      NODE_ENV: "development"
    },
    watch: false
  }]
}