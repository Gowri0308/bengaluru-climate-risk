<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>flood_class_style</Name>
    <UserStyle>
      <Name>flood_class_style</Name>
      <Title>Flood susceptibility classes</Title>
      <Abstract>Classes from flood_class.tif: 1 Low, 2 Medium, 3 High; water and nodata are not drawn.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.85</Opacity>
            <ColorMap type="values">
              <ColorMapEntry color="#c4e6b8" quantity="1" label="Low"/>
              <ColorMapEntry color="#5fbcc0" quantity="2" label="Medium"/>
              <ColorMapEntry color="#16306b" quantity="3" label="High"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
