import React, { useState } from "react";
import { View, Button, TextInput, Text } from "react-native";
import * as DocumentPicker from "expo-document-picker";

export default function AgentKYCUploadScreen({ agentId }) {
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const pickDocument = async () => {
    let result = await DocumentPicker.getDocumentAsync({});
    if (result.type === "success") {
      setFile(result);
    }
  };

  const uploadKYC = async () => {
    if (!documentType || !file) return;
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    });
    formData.append("agent_id", agentId);
    const res = await fetch("/agent/kyc/upload", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "multipart/form-data" },
    });
    const data = await res.json();
    setStatus(data.status || "Error");
  };

  return (
    <View>
      <Text>KYC Document Upload</Text>
      <TextInput
        placeholder="Document Type (e.g. Aadhaar, PAN)"
        value={documentType}
        onChangeText={setDocumentType}
      />
      <Button title="Pick Document" onPress={pickDocument} />
      {file && <Text>Selected: {file.name}</Text>}
      <Button title="Upload" onPress={uploadKYC} />
      {status && <Text>Status: {status}</Text>}
    </View>
  );
}
