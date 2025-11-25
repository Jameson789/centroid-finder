"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Slider, Container, Box, Typography, Checkbox, TextField, IconButton, Alert, Collapse} from "@mui/material";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import StartProcess from "./StartProcess";
import { AreaSelector } from '@bmunozg/react-image-area';
import useBinarizedImage from "@/hooks/useBinarizedImage";
import useAreaValidation from "@/hooks/useAreaValidation";

export default function PreviewVideo({ params }) {
  // Get filename from URL
  const { filename } = useParams();

  // States for color, threshold
  const [color, setColor] = useState("#000000");
  const [threshold, setThreshold] = useState(100);

  // States for areas
  const [areas, setAreas] = useState([]); // collected area data
  const [areaData, setAreaData] = useState([]); // computed area data
  const [areaToggle, setAreaToggle] = useState(false); // toggle for optional area selections
  const [areaNames, setAreaNames] = useState(['1', '2']); // area names

  // States for alerts
  const [infoAlert, setInfoAlert] = useState(false);

  // errors
  const {
    error,
    errorMessages,
    checkErrors,
    clearErrors
  } = useAreaValidation(areaNames, areas, areaToggle);

  // Refs for canvas and image
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const canvasRef = useBinarizedImage(imgRef, imgLoaded, color, threshold);

  // Thumbnail URL
  const thumbnailUrl = `http://localhost:3000/thumbnail/${encodeURIComponent(
    filename
  )}`;

  // Load thumbnail image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = thumbnailUrl;

    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
  }, [thumbnailUrl]);

  // Calculate area data
  useEffect(() => {
    if (imgRef.current){
      const img = imgRef.current
      const height = img.height;
      const width = img.width;
      const newAreaData = [];
      areas.forEach(area => {
        const newArea = {};
        newArea.x = Math.round(area.x * width / 100);
        newArea.y = Math.round(area.y * height / 100);
        newArea.width = Math.round(area.width * width / 100);
        newArea.height = Math.round(area.height * height / 100);
        newAreaData.push(newArea)
      });
      
      setAreaData(newAreaData);
    }
    
  }, [areas])

  // ---- Handlers ----

  // handle change of area names
  const handleNameChange = (index, newVal) => {
    setAreaNames(prev => {
      const newNames = [...prev];
      newNames[index] = newVal;
      return newNames;
    })
  }

  // Add area selection
  const addArea = () => {
    let num = areaNames.length;
    if (num >= 10){
      // don't do anything if 10 or more areas
    } else {
      num++;
      setAreaNames(prev => [...prev, `${num}`]);
      clearErrors();
    }
  }

  // Delete area selection
  const deleteArea = () => {
    if (areaNames.length <= 1){
      // don't do anything if 1 or less areas
    } else {
      if (areaNames.length == areas.length){
        setAreas(prev => prev.slice(0, -1));
      }
      setAreaNames(prev => prev.slice(0, -1));
      clearErrors();
    }
  }

  // render area name in area selector
  const renderAreaNames = (areaProps) => {
    if (!areaProps.isChanging) {
        return (
            <div key={areaProps.areaNumber}>
                <Typography
                sx={{
                  textShadow: '1px 1px white, -1px -1px white, -1px 1px white, 1px -1px white',
                  opacity: '65%'
                }}
                >{areaNames[areaProps.areaNumber - 1]}</Typography>
            </div>
        );
    }
  };

  // ---- Styles ----

  // Card style
  const cardStyle = {
    padding: 2,
    borderRadius: 2,
    backgroundColor: "#fff",
    boxShadow: 1,
    textAlign: "center",
    maxWidth: 320,
    flex: "1 1 320px",
  };

  // Original Image thumbnail
  const OgImage = () => {
    return(
    <img
      src={thumbnailUrl}
      alt="Original thumbnail"
      style={{
        width: "300px",
        borderRadius: 8,
        border: "1px solid #ccc",
      }}
    /> )
  }

  // ---- Rendering ----
  return (
    <Container maxWidth="md" sx={{ py: 5, px: 3, bgcolor: "#f9f9f9", borderRadius: 2, boxShadow: 2, marginTop: 2 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, marginBottom: 2 }}>
        {/* Title */}
        <Typography variant="h4" sx={{ fontWeight: 600, color: "#1976d2" }}>
          Preview: {filename}
        </Typography>

        {/* Preview cards */}
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
          
          {/* Original image */}
          <Box sx={cardStyle}>
            <Typography variant="h6" gutterBottom>
              Original
            </Typography>
            {areaToggle &&
              <AreaSelector
                areas={areas}
                onChange={(areas) => setAreas(areas)}
                customAreaRenderer={renderAreaNames}
                maxAreas={areaNames.length}
                unit="percentage"
              >
                <OgImage />
              </AreaSelector>
            }
            {!areaToggle && <OgImage />}
          </Box>

          {/* Binarized image */}
          <Box sx={cardStyle}>
            <Typography variant="h6" gutterBottom>
              Binarized
            </Typography>
            <canvas
              ref={canvasRef}
              style={{
                width: "300px",
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
          </Box>
        </Box>

        {/* Alerts */}
        <Collapse in={infoAlert}>
        <Alert 
          onClose={() => {setInfoAlert(false)}} 
          severity="info"
        >
          Click original thumbnail to make region selection(s)
        </Alert>
        </Collapse>

        {
          error && 
          <>
            {errorMessages.map((value, index) => (
              <Alert
              key={index}
              severity="error"
              >
                {value}
              </Alert>
            ))}
          </> 
        }

        {/* Controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
            padding: 3,
            borderRadius: 2,
            backgroundColor: "#fff",
            boxShadow: 1,
            justifyContent: "center",
          }}
        >
          {/* Color picker */}
          <Typography>Pick Target Color:</Typography>
          <input
            type="color"
            
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: 40,
              height: 40,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          />
          {/* Threshold slider */}
          <Typography sx={{ marginLeft: 2 }}>Threshold:</Typography>
          <Slider
            value={threshold}
            min={0}
            max={255}
            onChange={(e, newValue) => setThreshold(newValue)}
            sx={{ width: 250 }}
          />

          {/* Area Selector */}
          <Typography sx={{ marginLeft: 2 }}>Set Regions:</Typography>
          <Checkbox
            onChange={(e) => {
              setAreaToggle(prev => !prev);
              setInfoAlert(!areaToggle);
              clearErrors();
            }}
          />
          {/* Area Names inputs */}
          {areaToggle && 
            <div>
              {areaNames.map((value, index) => (
                <TextField
                  key={index} 
                  value={value}
                  label={'Region ' + (index + 1) }
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  size="small"
                  sx={{ marginLeft: 2, marginBottom: 2 }}
                />
              ))}
              {/* Delete last area button */}
              <IconButton
                onClick={() => {
                  deleteArea();
                }}
                disabled={areaNames.length <= 1}
              >
                <RemoveCircleOutlineIcon />
              </IconButton>
              
              {/* Add area button */}
              <IconButton
                onClick={() => {
                  addArea();
                }}
                disabled={areaNames.length >= 10}
              >
                <AddCircleOutlineIcon />
              </IconButton>
              
            </div>
          }


        </Box>
      </Box>

      {/* Process button */}
      <StartProcess
        filename={filename}
        color={color}
        threshold={threshold}
        areaValues={areaToggle ? areaData : []}
        areaNames={areaToggle ? areaNames : []}
        checkErrors={checkErrors}
      />
      
    </Container>
  );
}
