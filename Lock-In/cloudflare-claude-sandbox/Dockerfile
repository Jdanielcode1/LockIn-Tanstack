# Use Cloudflare's official sandbox base image
FROM docker.io/cloudflare/sandbox:0.3.3

# Install additional development tools that Claude Code might need
RUN apt-get update && apt-get install -y \
    git \
    vim \
    nano \
    curl \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install additional Python packages for data analysis and ML
RUN pip install --no-cache-dir \
    pandas \
    numpy \
    matplotlib \
    requests

# Install additional Node.js tools
RUN npm install -g \
    typescript \
    ts-node \
    nodemon \
    prettier \
    eslint

# Set working directory
WORKDIR /workspace

# The sandbox will mount user code here at runtime
