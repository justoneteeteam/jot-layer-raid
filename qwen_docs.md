# Qwen API Documentation (DashScope)

Call Qwen models using the DashScope API. It includes descriptions of request and response parameters and provides code examples.

## Endpoints by Region

### Singapore
- **Plain text models** (such as `qwen-plus`): `POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **Multimodal models** (such as `qwen3.6-plus` or `qwen3-vl-plus`): `POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- **SDK base_url**: `https://dashscope-intl.aliyuncs.com/api/v1`

### US (Virginia)
- **Plain text models**: `POST https://dashscope-us.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **Qwen-VL models**: `POST https://dashscope-us.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- **SDK base_url**: `https://dashscope-us.aliyuncs.com/api/v1`

### China (Beijing)
- **Plain text models**: `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **Multimodal models**: `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- *(No `base_url` configuration needed for SDK calls)*

### China (Hong Kong)
- **Plain text models**: `POST https://cn-hongkong.dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **Multimodal models**: `POST https://cn-hongkong.dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- **SDK base_url**: `https://cn-hongkong.dashscope.aliyuncs.com/api/v1`

### Germany (Frankfurt)
- **Plain text models**: `POST https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **Multimodal models**: `POST https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- **SDK base_url**: `https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1`

---

## Authentication
Before you begin, ensure you have an API key and configured it as an environment variable (`DASHSCOPE_API_KEY`).

---

## Request Body Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| **model** | `string` | **Yes** | The model name (e.g., `qwen-plus`, `qwen3-vl-plus`, `qwen2.5-vl-72b-instruct`). |
| **messages** | `array` | **Yes** | The context passed to the model, arranged in conversational order. Contains objects with `role` (`system`, `user`, `assistant`, `tool`) and `content`. `content` can be a string or an array of multimodal objects (e.g., `{"image": "url"}` or `{"video": ["url1", "url2"], "fps": 2.0}`). |
| **temperature** | `float` | No | Sampling temperature [0, 2). Higher = more diverse. |
| **top_p** | `float` | No | Nucleus sampling probability threshold (0, 1.0]. |
| **top_k** | `integer` | No | Candidate set size for sampling. |
| **enable_thinking** | `boolean` | No | Enables deep thinking mode for supported models. Returns `reasoning_content`. |
| **repetition_penalty** | `float` | No | Controls repetition (>0, 1.0 = no penalty). |
| **presence_penalty** | `float` | No | Controls avoidance of repeating content [-2.0, 2.0]. |
| **vl_high_resolution_images** | `boolean` | No | Increases max pixel limit for images (Qwen-VL). Default: `false`. |
| **max_tokens** | `integer` | No | Maximum number of tokens in the response. |
| **seed** | `integer` | No | Random seed for reproducible results. |
| **stream** | `boolean` | No | Enables SSE streaming response. Default: `false`. |
| **incremental_output**| `boolean` | No | If streaming, whether each chunk only contains newly generated content. Default: `false` for text, `true` for some VL/thinking models. |
| **result_format** | `string` | No | `text` or `message`. Recommended to set to `message` for multi-turn chats. |
| **response_format** | `object` | No | Enforce JSON output: `{"type": "json_object"}`. |
| **tools** | `array` | No | Definitions of functions the model can call. |

### Multimodal Specific Parameters (inside message content or parameters)
- **fps**: For video inputs, frames extracted per second (default: 2.0).
- **min_pixels** / **max_pixels**: Thresholds for scaling input images/video frames.
- **total_pixels**: Limits total pixels across all frames in a video.

---

## Response Object

```json
{
  "status_code": 200,
  "request_id": "902fee3b-f7f0-9a8c-96a1-6b4ea25af114",
  "output": {
    "choices": [
      {
        "finish_reason": "stop",
        "message": {
          "role": "assistant",
          "content": "I am a large-scale language model developed by Alibaba Cloud, and my name is Qwen.",
          "reasoning_content": "..." // Present if enable_thinking=true
        }
      }
    ]
  },
  "usage": {
    "input_tokens": 22,
    "output_tokens": 17,
    "total_tokens": 39
  }
}
```

---

## Examples (Python SDK)

### 1. Plain Text Generation
```python
import os
import dashscope

dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

messages = [
    {'role': 'system', 'content': 'You are a helpful assistant.'},
    {'role': 'user', 'content': 'Who are you?'}
]

response = dashscope.Generation.call(
    api_key=os.getenv('DASHSCOPE_API_KEY'),
    model="qwen-plus",
    messages=messages,
    result_format='message'
)
print(response)
```

### 2. Multimodal: Image Input (Qwen-VL)
```python
import os
from dashscope import MultiModalConversation
import dashscope

dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

messages = [{
    "role": "user",
    "content": [
        {"image": "https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg"},
        {"text": "What is depicted in the image?"}
    ]
}]

response = MultiModalConversation.call(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    model='qwen3-vl-plus',
    messages=messages
)
print(response)
```

### 3. Multimodal: Video/Image List Input (Qwen2.5-VL)
```python
import os
from dashscope import MultiModalConversation
import dashscope

dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

messages = [{
    "role": "user", 
    "content": [
        {
            "video": [
                "https://help-static-aliyun-doc.aliyuncs.com/.../football1.jpg",
                "https://help-static-aliyun-doc.aliyuncs.com/.../football2.jpg",
                "https://help-static-aliyun-doc.aliyuncs.com/.../football3.jpg",
                "https://help-static-aliyun-doc.aliyuncs.com/.../football4.jpg"
            ],
            "fps": 2
        },
        {"text": "Describe the process in this video"}
    ]
}]

response = MultiModalConversation.call(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    model='qwen2.5-vl-72b-instruct',
    messages=messages
)
print(response["output"]["choices"][0]["message"].content[0]["text"])
```

### 4. Tool Calling (Function Calling)
```python
import os
import dashscope

dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

tools = [{
    "type": "function",
    "function": {
        "name": "get_current_weather",
        "description": "Useful for when you want to query the weather in a specific city.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "A city or district, such as Beijing, Hangzhou, or Yuhang."
                }
            },
            "required": ["location"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather like in Hangzhou?"}]

response = dashscope.Generation.call(
    api_key=os.getenv('DASHSCOPE_API_KEY'),
    model='qwen-plus',
    messages=messages,
    tools=tools,
    result_format='message'
)
print(response)
```

## Node.js / TypeScript Example (HTTP)
Since DashScope does not provide an official Node.js SDK, you can use standard HTTP requests (e.g., `fetch`) or the OpenAI-compatible endpoint.

```javascript
import fetch from 'node-fetch';

const apiKey = process.env.DASHSCOPE_API_KEY;
const data = {
  model: "qwen-plus",
  input: {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Who are you?" }
    ]
  },
  parameters: {
    result_format: "message"
  }
};

fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => console.log(JSON.stringify(data)))
.catch(error => console.error('Error:', error));
```

---

## Qwen-Image-Layered

**Model:** `Qwen/Qwen-Image-Layered`
**Paper:** [arXiv 2512.15603](https://arxiv.org/abs/2512.15603)
**License:** Apache 2.0
**GitHub:** [QwenLM/Qwen-Image-Layered](https://github.com/QwenLM/Qwen-Image-Layered)
**Demo:** [HuggingFace Spaces](https://huggingface.co/spaces/Qwen/Qwen-Image-Layered)

### Overview
Qwen-Image-Layered decomposes a raster image into **multiple RGBA layers** with transparency. Each layer can be independently manipulated (resize, reposition, recolor, delete) without affecting other content. This enables high-fidelity, consistent editing by physically isolating semantic/structural components.

### Key Capabilities
- **Variable layer count:** Decompose into 3, 4, 8, or more layers
- **Recursive decomposition:** Any layer can be further decomposed into sub-layers
- **Output formats:** Individual RGBA PNGs, PSD (Photoshop), PPTX (PowerPoint), ZIP
- **Works with Qwen-Image-Edit:** After decomposition, individual layers can be edited with `Qwen-Image-Edit`

### Installation
```bash
# Requires transformers >= 4.51.3 (Qwen2.5-VL support)
pip install git+https://github.com/huggingface/diffusers
pip install python-pptx
pip install psd-tools
```

### Python Usage (Local GPU)
```python
from diffusers import QwenImageLayeredPipeline
import torch
from PIL import Image

pipeline = QwenImageLayeredPipeline.from_pretrained("Qwen/Qwen-Image-Layered")
pipeline = pipeline.to("cuda", torch.bfloat16)
pipeline.set_progress_bar_config(disable=None)

image = Image.open("jersey.png").convert("RGBA")

inputs = {
    "image": image,
    "generator": torch.Generator(device='cuda').manual_seed(777),
    "true_cfg_scale": 4.0,
    "negative_prompt": " ",
    "num_inference_steps": 50,
    "num_images_per_prompt": 1,
    "layers": 4,                # Number of layers to decompose into
    "resolution": 640,          # Bucket size (640 or 1024). 640 recommended
    "cfg_normalize": True,      # Whether to enable cfg normalization
    "use_en_prompt": True,      # Automatic caption language if no caption provided
}

with torch.inference_mode():
    output = pipeline(**inputs)

output_image = output.images[0]
for i, layer in enumerate(output_image):
    layer.save(f"layer_{i}.png")  # Each is an RGBA PIL Image
```

### Pipeline Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `image` | `PIL.Image` | **Required** | Input image, should be RGBA |
| `layers` | `int` | 4 | Number of RGBA layers to decompose into |
| `resolution` | `int` | 640 | Processing resolution bucket (640 or 1024). 640 recommended |
| `num_inference_steps` | `int` | 50 | Denoising steps |
| `true_cfg_scale` | `float` | 4.0 | Classifier-free guidance scale |
| `negative_prompt` | `str` | `" "` | Negative prompt |
| `cfg_normalize` | `bool` | `True` | Enable CFG normalization |
| `use_en_prompt` | `bool` | `True` | Auto-caption in English if no prompt given |
| `generator` | `torch.Generator` | None | For reproducible results |

### Deployment (Gradio Web UI)
```bash
# Launch decomposition UI (exports to pptx, zip, psd)
python src/app.py

# Launch layer editing UI (using Qwen-Image-Edit)
python src/tool/edit_rgba_image.py

# Combine edited layers back into one image
python src/tool/combine_layers.py
```

### vLLM-Omni Support
[vLLM-Omni](https://github.com/vllm-project/vllm-omni) supports Qwen-Image-Layered for production deployment. See the [recipes](https://docs.vllm.ai/projects/recipes/en/latest/Qwen/Qwen-Image.html) for details.

### Important Notes
- The text prompt describes the **overall content** of the input image (including occluded elements). It does NOT control the semantic content of individual layers.
- The released weights are fine-tuned specifically for **image-to-multi-RGBA decomposition**. Text-to-multi-RGBA generation performance is limited.
- This is a **diffusion model** (not an LLM API call). It requires a **GPU with sufficient VRAM** to run locally or via vLLM-Omni.
