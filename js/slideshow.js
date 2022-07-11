const images_path = '../images'

class Slideshow{
    constructor() {
        let images_path = 'images/'
        this.images = [
          images_path + 'glasses.png',
          images_path + 'burger.png',
          images_path + 'salad.png',
          images_path + 'blt.png',
          images_path + 'soup.png',
        ]

        this.current_index = 0
      }

    change(){
      if ( this.current_index >= this.images.length - 1){
        this.current_index = 0
      }
      else{
        this.current_index += 1
      }

      $('#pa-slideshow').attr('src', this.images[this.current_index])
    }

    start(){
        setInterval(this.change.bind(this), 5000)
    }

    stop(){

    }
}

slideshow = new Slideshow()

slideshow.start()