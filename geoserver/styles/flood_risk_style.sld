<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>flood_risk_style</Name>
    <UserStyle>
      <Name>flood_risk_style</Name>
      <Title>Flood risk index</Title>
      <Abstract>Flood risk index 1 (safe) to 5 (very flood-prone); cream to navy ramp. Nodata -9999 transparent.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.85</Opacity>
            <ColorMap type="ramp">
              <ColorMapEntry color="#000000" quantity="-9999" label="No data" opacity="0"/>
              <ColorMapEntry color="#fbf6d9" quantity="1" label="1 Safe"/>
              <ColorMapEntry color="#c4e6b8" quantity="2" label="2"/>
              <ColorMapEntry color="#5fbcc0" quantity="3" label="3"/>
              <ColorMapEntry color="#2b7bb3" quantity="4" label="4"/>
              <ColorMapEntry color="#16306b" quantity="5" label="5 Very flood-prone"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
