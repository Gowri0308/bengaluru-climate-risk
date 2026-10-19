<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>heat_risk_style</Name>
    <UserStyle>
      <Name>heat_risk_style</Name>
      <Title>Heat index</Title>
      <Abstract>Heat index 0 (coolest) to 1 (hottest, least green); pale yellow to deep red. Nodata (-9999, set in the GeoTIFF) is not drawn.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.85</Opacity>
            <ColorMap type="ramp">
              <ColorMapEntry color="#fff3b8" quantity="0" label="0 Coolest"/>
              <ColorMapEntry color="#fec65c" quantity="0.25" label="0.25"/>
              <ColorMapEntry color="#fd8a3c" quantity="0.5" label="0.5"/>
              <ColorMapEntry color="#e2412b" quantity="0.75" label="0.75"/>
              <ColorMapEntry color="#a50f26" quantity="1" label="1 Hottest"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
