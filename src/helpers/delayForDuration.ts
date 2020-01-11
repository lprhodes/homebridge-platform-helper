const delayForDuration = (duration: number) => {
    return new Promise((resolve) => {
      setTimeout(resolve, duration * 1000)
    })
  }

  export default delayForDuration