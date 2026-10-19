<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>flood_2022_style</Name>
    <UserStyle>
      <Name>flood_2022_style</Name>
      <Title>September 2022 flood (Sentinel-1)</Title>
      <Abstract>flood_2022_observed.tif: 1 = flooded (blue fill), 0 and 255 transparent.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.85</Opacity>
            <ColorMap type="values">
              <ColorMapEntry color="#000000" quantity="0" label="Not flooded" opacity="0"/>
              <ColorMapEntry color="#1f78b4" quantity="1" label="Flooded, Sept 2022"/>
              <ColorMapEntry color="#000000" quantity="255" label="No data" opacity="0"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
