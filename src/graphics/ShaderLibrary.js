// Custom GLSL shaders for ATM

export const phongVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const phongFragmentShader = `
  uniform vec3 uLightPosition;
  uniform vec3 uLightColor;
  uniform vec3 uAmbientColor;
  uniform vec3 uDiffuseColor;
  uniform vec3 uSpecularColor;
  uniform float uShininess;
  uniform float uOpacity;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightPosition - vPosition);
    vec3 V = normalize(-vPosition);
    vec3 R = reflect(-L, N);
    
    vec3 ambient = uAmbientColor * uDiffuseColor;
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = uLightColor * uDiffuseColor * NdotL;
    
    float RdotV = max(dot(R, V), 0.0);
    vec3 specular = uLightColor * uSpecularColor * pow(RdotV, uShininess);
    if (NdotL <= 0.0) specular = vec3(0.0);
    
    vec3 finalColor = ambient + diffuse + specular;
    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export const gouraudVertexShader = `
  uniform vec3 uLightPosition;
  uniform vec3 uLightColor;
  uniform vec3 uAmbientColor;
  uniform vec3 uDiffuseColor;
  uniform vec3 uSpecularColor;
  uniform float uShininess;
  
  varying vec3 vColor;
  
  void main() {
    vec3 mvPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vec3 N = normalize(normalMatrix * normal);
    vec3 L = normalize(uLightPosition - mvPosition);
    vec3 V = normalize(-mvPosition);
    vec3 R = reflect(-L, N);
    
    vec3 ambient = uAmbientColor * uDiffuseColor;
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = uLightColor * uDiffuseColor * NdotL;
    
    vec3 specular = vec3(0.0);
    if (NdotL > 0.0) {
      specular = uLightColor * uSpecularColor * pow(max(dot(R, V), 0.0), uShininess);
    }
    
    vColor = ambient + diffuse + specular;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const gouraudFragmentShader = `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, uOpacity);
  }
`;

export const phongChassisUniforms = {
  uLightPosition: { value: [5.0, 8.0, 5.0] },
  uLightColor: { value: [1.0, 0.98, 0.95] },
  uAmbientColor: { value: [0.15, 0.15, 0.18] },
  uDiffuseColor: { value: [0.1, 0.1, 0.15] },
  uSpecularColor: { value: [0.8, 0.8, 0.85] },
  uShininess: { value: 64.0 },
  uOpacity: { value: 1.0 },
};

export const gouraudButtonUniforms = {
  uLightPosition: { value: [5.0, 8.0, 5.0] },
  uLightColor: { value: [1.0, 0.98, 0.95] },
  uAmbientColor: { value: [0.12, 0.12, 0.15] },
  uDiffuseColor: { value: [0.35, 0.38, 0.42] },
  uSpecularColor: { value: [0.3, 0.3, 0.35] },
  uShininess: { value: 16.0 },
  uOpacity: { value: 1.0 },
};

export function createThreeUniforms(uniformConfig, THREE) {
  const uniforms = {};
  for (const [key, val] of Object.entries(uniformConfig)) {
    if (Array.isArray(val.value) && val.value.length === 3) {
      uniforms[key] = { value: new THREE.Vector3(...val.value) };
    } else {
      uniforms[key] = { value: val.value };
    }
  }
  return uniforms;
}
