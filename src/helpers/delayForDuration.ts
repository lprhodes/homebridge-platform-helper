const delayForDuration = (duration: number): Promise<void>  => {
    return new Promise((resolve) => {
      setTimeout(resolve, duration * 1000)
    })
  }

  export default delayForDuration