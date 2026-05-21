import axios from 'axios';

const handleCreatePost = async () => {
    if (!image) {
      toast.error("Please provide an image or video to create a post.");
      return;
    }
    onClose(); // Close the modal immediately
  
    const createPostProcess = async () => {
      let mediaPaths;
      try {
        const contentType = image ? "image" : "video";
        
        const response = await axios.post(
          "https://application-server-cwqu.onrender.com/api/images",
          // "http://localhost:8000/api/images",
          image,
          { 
            headers: { 
              "content-Type": `multipart/form-${contentType}` 
            } 
          }
        );
        mediaPaths = response.data.imagePaths;
      } catch (error) {
        toast.error("An error occurred while uploading media!");
        console.error("Error uploading media:", error);
        return;
      }
  
      console.log(mediaPaths, 'mediaPath');
    };
  
    // Start the post creation process without waiting for it to complete
    createPostProcess();
  };

  handleCreatePost();